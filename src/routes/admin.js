'use strict';
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const settings = require('../lib/settings');
const cache = require('../lib/cache');
const C = require('../lib/content');
const charts = require('../lib/charts');
const indexnow = require('../lib/indexnow');
const { renderPlain } = require('../lib/markdown');
const auth = require('../lib/auth');
const { slugify, nowIso, toArr, fromLocalInput, today } = require('../lib/utils');

const router = express.Router();

// ------------------------------------------------------------------ Upload immagini
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (req, file, cb) => cb(null, `${today()}-${slugify(path.parse(file.originalname).name).slice(0, 40)}-${crypto.randomBytes(3).toString('hex')}${ALLOWED[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED[file.mimetype]),
});

// ------------------------------------------------------------------ Middleware comuni
router.use(auth.loadUser);
router.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.flash = req.query.ok ? String(req.query.ok) : '';
  res.locals.flashErr = req.query.err ? String(req.query.err) : '';
  res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
const afterWrite = () => cache.bust();
const back = (res, url, msg, isErr) => res.redirect(303, `${url}${url.includes('?') ? '&' : '?'}${isErr ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);
function uniqueSlug(table, base, id) {
  let slug = slugify(base);
  let n = 2;
  while (db.get(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, slug, id || 0)) slug = `${slugify(base)}-${n++}`;
  return slug;
}
function addRedirect(from, to) {
  if (!from || from === to) return;
  db.run('DELETE FROM redirects WHERE from_path = ?', to); // evita loop
  db.run('UPDATE redirects SET to_path = ? WHERE to_path = ?', to, from); // comprime catene
  db.run('INSERT INTO redirects(from_path, to_path) VALUES (?, ?) ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path', from, to);
}

// ------------------------------------------------------------------ Setup iniziale e login
const hasUsers = () => db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin'").n > 0;

router.get('/setup', (req, res) => (hasUsers() ? res.redirect('/admin/login') : res.render('admin/setup', { title: 'Configurazione iniziale', error: '' })));
router.post('/setup', (req, res) => {
  if (hasUsers()) return res.redirect('/admin/login');
  const { name, email, password, site_name, site_url_note } = req.body;
  if (!name || !/^[^\s@]+@[^\s@]+$/.test(email || '') || String(password || '').length < 10) {
    return res.status(400).render('admin/setup', { title: 'Configurazione iniziale', error: 'Compila tutti i campi. La password deve avere almeno 10 caratteri.' });
  }
  const r = db.run('INSERT INTO users(email, name, slug, password_hash, role, job_title) VALUES (?, ?, ?, ?, ?, ?)',
    email.trim().toLowerCase(), name.trim(), uniqueSlug('users', name), auth.hashPassword(password), 'admin', 'Direttore editoriale');
  if (site_name) settings.set({ site_name, organization_name: site_name });
  void site_url_note;
  settings.ensureIndexNowKey();
  auth.createSession(res, r.lastInsertRowid);
  res.redirect('/admin?ok=' + encodeURIComponent('Benvenuto! Il tuo CMS è pronto.'));
});

router.get('/login', (req, res) => {
  if (!hasUsers()) return res.redirect('/admin/setup');
  if (req.user) return res.redirect('/admin');
  res.render('admin/login', { title: 'Accedi', error: '', next: req.query.next || '/admin' });
});
router.post('/login', (req, res) => {
  const nextUrl = String(req.body.next || '/admin');
  const safeNext = nextUrl.startsWith('/admin') ? nextUrl : '/admin';
  if (!auth.rateLimit('login:' + req.ip, 8, 15 * 60 * 1000)) {
    return res.status(429).render('admin/login', { title: 'Accedi', error: 'Troppi tentativi. Riprova tra 15 minuti.', next: safeNext });
  }
  const u = db.get('SELECT * FROM users WHERE email = ?', String(req.body.email || '').trim().toLowerCase());
  if (!u || !auth.verifyPassword(req.body.password, u.password_hash)) {
    return res.status(401).render('admin/login', { title: 'Accedi', error: 'Email o password non corretti.', next: safeNext });
  }
  auth.createSession(res, u.id);
  res.redirect(303, safeNext);
});

// Da qui in poi: autenticazione + CSRF obbligatori
router.use((req, res, next) => (!hasUsers() ? res.redirect('/admin/setup') : next()));
router.use(auth.requireAuth);

// L'upload è multipart: il token CSRF viene letto dopo multer
router.post('/media/upload', upload.array('files', 10), auth.verifyCsrf, (req, res) => {
  const out = [];
  for (const f of req.files || []) {
    const r = db.run('INSERT INTO media(filename, original, mime, size, alt) VALUES (?, ?, ?, ?, ?)', f.filename, f.originalname, f.mimetype, f.size, String(req.body.alt || ''));
    out.push({ id: Number(r.lastInsertRowid), url: `/uploads/${f.filename}`, name: f.originalname });
  }
  if ((req.headers.accept || '').includes('application/json')) return res.json({ ok: true, files: out });
  back(res, '/admin/media', out.length ? `${out.length} file caricati` : 'Nessun file valido (JPG, PNG, WebP, GIF, AVIF, max 8 MB)', !out.length);
});
router.use(auth.verifyCsrf);

router.post('/logout', (req, res) => { auth.destroySession(req, res); res.redirect('/admin/login'); });

// ------------------------------------------------------------------ Dashboard
router.get('/', (req, res) => {
  const now = nowIso();
  const counts = {
    published: db.get(`SELECT COUNT(*) n FROM articles a WHERE ${C.PUB}`, now).n,
    drafts: db.get("SELECT COUNT(*) n FROM articles WHERE status = 'draft'").n,
    scheduled: db.get("SELECT COUNT(*) n FROM articles WHERE status = 'published' AND published_at > ?", now).n,
    subscribers: db.get('SELECT COUNT(*) n FROM subscribers').n,
    tools: db.get('SELECT COUNT(*) n FROM tools').n,
    models: db.get('SELECT COUNT(*) n FROM ai_models').n,
    datasets: db.get('SELECT COUNT(*) n FROM datasets').n,
  };
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const stats = db.all('SELECT day, kind, count FROM daily_stats WHERE day >= ? ORDER BY day', since30);
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const val = (d, k) => stats.find((s) => s.day === d && s.kind === k)?.count || 0;
  const csv = 'Giorno,Visualizzazioni,Click affiliati\n' + days.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)},${val(d, 'view')},${val(d, 'click')}`).join('\n');
  const trafficSvg = charts.renderChart({ title: 'Ultimi 30 giorni', slug: 'dash', chart_type: 'line', data_csv: csv });
  const totals = { views: stats.filter((s) => s.kind === 'view').reduce((a, b) => a + b.count, 0), clicks: stats.filter((s) => s.kind === 'click').reduce((a, b) => a + b.count, 0), subs: stats.filter((s) => s.kind === 'subscribe').reduce((a, b) => a + b.count, 0) };
  const conv = (Number(settings.get('affiliate_conversion_rate')) || 0) / 100;
  const topTools = db.all(`SELECT t.id, t.name, t.slug, t.commission, COUNT(c.id) clicks30 FROM tools t LEFT JOIN clicks c ON c.tool_id = t.id AND c.created_at >= ?
    GROUP BY t.id ORDER BY clicks30 DESC, t.clicks DESC LIMIT 6`, since30).map((t) => ({ ...t, revenue: t.clicks30 * conv * (t.commission || 0) }));
  const estRevenue = topTools.reduce((a, t) => a + t.revenue, 0);
  const topArticles = db.all(`SELECT id, title, slug, views, seo_score, aeo_score, geo_score FROM articles a WHERE ${C.PUB} ORDER BY views DESC LIMIT 6`, now);
  const toImprove = db.all("SELECT id, title, seo_score, aeo_score, geo_score, status FROM articles ORDER BY (seo_score + aeo_score + geo_score) ASC LIMIT 5");
  const topSources = db.all('SELECT source, COUNT(*) n FROM clicks WHERE created_at >= ? GROUP BY source ORDER BY n DESC LIMIT 5', since30);
  res.render('admin/dashboard', { title: 'Dashboard', counts, totals, trafficSvg, topTools, estRevenue, topArticles, toImprove, topSources });
});

// ------------------------------------------------------------------ Articoli
router.get('/articoli', (req, res) => {
  const where = [];
  const args = [];
  const { q = '', stato = '', categoria = '' } = req.query;
  if (q) { where.push('(a.title LIKE ? OR a.focus_keyword LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (stato === 'draft') where.push("a.status = 'draft'");
  if (stato === 'published') { where.push("a.status = 'published' AND a.published_at <= ?"); args.push(nowIso()); }
  if (stato === 'scheduled') { where.push("a.status = 'published' AND a.published_at > ?"); args.push(nowIso()); }
  if (categoria) { where.push('a.category_id = ?'); args.push(Number(categoria)); }
  if (req.user.role === 'author') { where.push('a.author_id = ?'); args.push(req.user.id); }
  const list = db.all(`${C.BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT 300`, ...args);
  res.render('admin/articles', { title: 'Articoli', list, q, stato, categoria, cats: db.all('SELECT id, name FROM categories ORDER BY sort, name'), now: nowIso() });
});

function articleFormData(a) {
  return {
    a,
    cats: db.all('SELECT id, name FROM categories ORDER BY sort, name'),
    authors: db.all('SELECT id, name, bio FROM users ORDER BY name'),
    tools: db.all('SELECT id, name, slug FROM tools ORDER BY name'),
    datasets: db.all('SELECT title, slug FROM datasets ORDER BY title'),
    models: db.all('SELECT name, slug FROM ai_models ORDER BY name'),
    selectedTools: a.id ? db.all('SELECT tool_id FROM article_tools WHERE article_id = ? ORDER BY sort', a.id).map((x) => x.tool_id) : [],
    tagsStr: a.id ? db.all('SELECT t.name FROM tags t JOIN article_tags x ON x.tag_id = t.id WHERE x.article_id = ?', a.id).map((t) => t.name).join(', ') : '',
  };
}
router.get('/articoli/nuovo', (req, res) => {
  res.render('admin/article-form', { title: 'Nuovo articolo', ...articleFormData({ type: 'news', status: 'draft', author_id: req.user.id, faq: '[]', steps: '[]', sources: '[]' }) });
});
router.get('/articoli/:id(\\d+)', (req, res) => {
  const a = db.get('SELECT * FROM articles WHERE id = ?', req.params.id);
  if (!a) return back(res, '/admin/articoli', 'Articolo non trovato', true);
  if (req.user.role === 'author' && a.author_id !== req.user.id) return back(res, '/admin/articoli', 'Puoi modificare solo i tuoi articoli', true);
  res.render('admin/article-form', { title: 'Modifica articolo', ...articleFormData(a) });
});

router.post('/articoli/salva', (req, res) => {
  const b = req.body;
  const id = Number(b.id) || 0;
  const old = id ? db.get('SELECT * FROM articles WHERE id = ?', id) : null;
  if (id && !old) return back(res, '/admin/articoli', 'Articolo non trovato', true);
  if (old && req.user.role === 'author' && old.author_id !== req.user.id) return back(res, '/admin/articoli', 'Permesso negato', true);
  if (!String(b.title || '').trim()) return back(res, id ? `/admin/articoli/${id}` : '/admin/articoli/nuovo', 'Il titolo è obbligatorio', true);

  const pairs = (qs, as) => toArr(qs).map((q, i) => [String(q || '').trim(), String(toArr(as)[i] || '').trim()]);
  const faq = pairs(b.faq_q, b.faq_a).filter(([q, a]) => q && a).map(([q, a]) => ({ q, a }));
  const steps = pairs(b.step_name, b.step_text).filter(([n, t]) => n && t).map(([name, text]) => ({ name, text }));
  const sources = toArr(b.src_url).map((u, i) => ({ url: String(u || '').trim(), title: String(toArr(b.src_title)[i] || '').trim(), publisher: String(toArr(b.src_publisher)[i] || '').trim() }))
    .filter((x) => /^https?:\/\//.test(x.url));

  let status = b.status === 'published' ? 'published' : 'draft';
  if (req.user.role === 'author' && status === 'published' && old?.status !== 'published') status = 'draft'; // gli autori inviano in revisione
  let publishedAt = fromLocalInput(b.published_at) || old?.published_at || null;
  if (status === 'published' && !publishedAt) publishedAt = nowIso();

  const a = {
    title: String(b.title).trim(),
    slug: uniqueSlug('articles', b.slug || b.title, id),
    type: ['news', 'guide', 'analysis', 'review', 'list'].includes(b.type) ? b.type : 'news',
    excerpt: b.excerpt || '', tldr: b.tldr || '', takeaways: b.takeaways || '', content_md: b.content_md || '',
    faq: JSON.stringify(faq), steps: JSON.stringify(steps), sources: JSON.stringify(sources),
    category_id: Number(b.category_id) || null,
    author_id: req.user.role === 'author' ? req.user.id : (Number(b.author_id) || req.user.id),
    cover_image: b.cover_image || '', cover_alt: b.cover_alt || '',
    status, featured: b.featured ? 1 : 0, sponsored: b.sponsored ? 1 : 0,
    focus_keyword: (b.focus_keyword || '').trim(), meta_title: (b.meta_title || '').trim(), meta_description: (b.meta_description || '').trim(),
    canonical_url: (b.canonical_url || '').trim(), noindex: b.noindex ? 1 : 0, published_at: publishedAt,
    updated_at: b.minor_edit && old ? old.updated_at : nowIso(),
  };
  const author = db.get('SELECT bio FROM users WHERE id = ?', a.author_id);
  const sc = C.scoreArticle(a, author);
  Object.assign(a, { word_count: sc.wordCount, reading_time: sc.readingTime, seo_score: sc.seo, aeo_score: sc.aeo, geo_score: sc.geo });

  const savedId = db.tx(() => {
    let aid = id;
    const cols = Object.keys(a);
    if (id) db.run(`UPDATE articles SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`, { ...a, id });
    else aid = Number(db.run(`INSERT INTO articles(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, a).lastInsertRowid);
    // tag
    db.run('DELETE FROM article_tags WHERE article_id = ?', aid);
    for (const name of String(b.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12)) {
      const slug = slugify(name);
      db.run('INSERT OR IGNORE INTO tags(name, slug) VALUES (?, ?)', name, slug);
      const t = db.get('SELECT id FROM tags WHERE slug = ?', slug);
      db.run('INSERT OR IGNORE INTO article_tags(article_id, tag_id) VALUES (?, ?)', aid, t.id);
    }
    db.run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM article_tags)');
    // strumenti affiliati collegati
    db.run('DELETE FROM article_tools WHERE article_id = ?', aid);
    toArr(b.tools).map(Number).filter(Boolean).forEach((tid, i) => db.run('INSERT OR IGNORE INTO article_tools(article_id, tool_id, sort) VALUES (?, ?, ?)', aid, tid, i));
    if (old && old.slug !== a.slug && old.status === 'published') addRedirect(`/articoli/${old.slug}`, `/articoli/${a.slug}`);
    C.syncFts({ ...a, id: aid });
    return aid;
  });
  afterWrite();
  if (status === 'published' && publishedAt <= nowIso() && !a.noindex) indexnow.ping([`/articoli/${a.slug}`, '/']).catch(() => {});
  const msg = status === 'published' ? (publishedAt > nowIso() ? 'Articolo programmato' : 'Articolo pubblicato') : (req.user.role === 'author' && b.status === 'published' ? 'Inviato in revisione (bozza)' : 'Bozza salvata');
  back(res, `/admin/articoli/${savedId}`, `${msg} · Punteggio SEO ${sc.seo} · AEO ${sc.aeo} · GEO ${sc.geo}`);
});

router.post('/articoli/:id(\\d+)/elimina', auth.requireRole('admin', 'editor'), (req, res) => {
  const a = db.get('SELECT slug FROM articles WHERE id = ?', req.params.id);
  db.run('DELETE FROM articles WHERE id = ?', req.params.id);
  db.run('DELETE FROM articles_fts WHERE rowid = ?', req.params.id);
  afterWrite();
  back(res, '/admin/articoli', a ? 'Articolo eliminato' : 'Articolo non trovato', !a);
});
router.post('/articoli/:id(\\d+)/duplica', (req, res) => {
  const a = db.get('SELECT * FROM articles WHERE id = ?', req.params.id);
  if (!a) return back(res, '/admin/articoli', 'Articolo non trovato', true);
  delete a.id;
  Object.assign(a, { title: a.title + ' (copia)', slug: uniqueSlug('articles', a.slug + '-copia'), status: 'draft', published_at: null, views: 0, created_at: nowIso(), updated_at: nowIso(), author_id: req.user.id });
  const cols = Object.keys(a);
  const nid = db.run(`INSERT INTO articles(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, a).lastInsertRowid;
  back(res, `/admin/articoli/${nid}`, 'Copia creata come bozza');
});

// Anteprima Markdown live per l'editor
router.post('/api/anteprima', (req, res) => {
  const body = C.renderBody({ id: 'preview-' + crypto.randomBytes(4).toString('hex'), updated_at: '', content_md: String(req.body.content || '') });
  res.json({ html: body.html, toc: body.toc });
});
router.get('/api/media', (req, res) => res.json(db.all('SELECT id, filename, original, alt FROM media ORDER BY id DESC LIMIT 60').map((m) => ({ ...m, url: `/uploads/${m.filename}` }))));

// ------------------------------------------------------------------ CRUD generico per le altre entità
const STATUS = [['published', 'Pubblicato'], ['draft', 'Bozza']];
const ENTITIES = {
  strumenti: {
    table: 'tools', label: 'Strumenti & affiliazioni', singular: 'strumento', titleField: 'name', order: 'featured DESC, name',
    publicPath: (r) => `/strumenti/${r.slug}`, columns: [['name', 'Nome'], ['category', 'Categoria'], ['rating', 'Voto'], ['clicks', 'Click'], ['status', 'Stato']],
    help: 'Inserisci il link di affiliazione: il sito userà sempre /go/slug con tracciamento click e rel="sponsored". Le parole chiave attivano l\'auto-link negli articoli. Shortcode: [[tool:slug]]',
    fields: [
      ['name', 'Nome', 'text', { required: true }], ['slug', 'Slug URL', 'slug'], ['category', 'Categoria', 'text', { placeholder: 'Scrittura AI, Hosting, Corsi, Finanza…' }],
      ['tagline', 'Descrizione breve', 'text'], ['description_md', 'Recensione / descrizione (Markdown)', 'markdown'],
      ['logo', 'Logo (URL o /uploads/…)', 'image'], ['website', 'Sito ufficiale', 'url'], ['affiliate_url', 'Link di affiliazione', 'url'],
      ['network', 'Network affiliazione', 'text', { placeholder: 'Amazon, Impact, PartnerStack, diretto…' }],
      ['commission', 'Commissione media per vendita (€)', 'number', { step: '0.01' }], ['pricing', 'Prezzo', 'text', { placeholder: 'da 9 €/mese' }],
      ['free_plan', 'Ha un piano gratuito', 'checkbox'], ['rating', 'Valutazione (0-5)', 'number', { step: '0.1', min: 0, max: 5 }],
      ['pros', 'Pro (uno per riga)', 'textarea'], ['cons', 'Contro (uno per riga)', 'textarea'], ['coupon', 'Codice sconto', 'text'],
      ['keywords', 'Parole chiave auto-link (separate da virgola)', 'text'], ['featured', 'In evidenza', 'checkbox'], ['status', 'Stato', 'select', { options: STATUS }],
    ],
  },
  modelli: {
    table: 'ai_models', label: 'Modelli AI', singular: 'modello', titleField: 'name', order: 'name',
    publicPath: (r) => `/modelli-ai/${r.slug}`, columns: [['name', 'Nome'], ['provider', 'Provider'], ['input_price', '$ input'], ['verified', 'Verificato'], ['status', 'Stato']],
    help: 'I prezzi sono in dollari per milione di token. Spunta "Dati verificati" solo dopo il controllo sul listino ufficiale: il badge di verifica è un segnale di affidabilità (E-E-A-T). Shortcode: [[model:slug]]',
    fields: [
      ['name', 'Nome', 'text', { required: true }], ['slug', 'Slug URL', 'slug'], ['provider', 'Provider', 'text'],
      ['model_type', 'Tipo', 'select', { options: [['LLM', 'LLM (testo)'], ['Multimodale', 'Multimodale'], ['Immagini', 'Immagini'], ['Video', 'Video'], ['Audio', 'Audio/voce'], ['Codice', 'Codice']] }],
      ['release_date', 'Data di rilascio', 'date'], ['context_window', 'Finestra di contesto (token)', 'number'],
      ['input_price', 'Prezzo input ($/1M token)', 'number', { step: '0.001' }], ['output_price', 'Prezzo output ($/1M token)', 'number', { step: '0.001' }],
      ['open_weights', 'Pesi aperti (open weights)', 'checkbox'], ['modalities', 'Modalità', 'text', { placeholder: 'testo, immagini, audio' }],
      ['description', 'Descrizione (Markdown)', 'markdown'], ['strengths', 'Punti di forza (uno per riga)', 'textarea'], ['weaknesses', 'Limiti (uno per riga)', 'textarea'],
      ['best_for', 'Ideale per', 'text'], ['website', 'Sito ufficiale', 'url'], ['tool_id', 'Strumento affiliato collegato', 'select', { options: () => [['', '— nessuno —'], ...db.all('SELECT id, name FROM tools ORDER BY name').map((t) => [String(t.id), t.name])] }],
      ['score_reasoning', 'Voto ragionamento (0-100)', 'number'], ['score_coding', 'Voto coding (0-100)', 'number'], ['score_speed', 'Voto velocità (0-100)', 'number'], ['score_value', 'Voto rapporto qualità/prezzo (0-100)', 'number'],
      ['verified', 'Dati verificati dalla redazione', 'checkbox'], ['checked_at', 'Data ultima verifica', 'date'], ['status', 'Stato', 'select', { options: STATUS }],
    ],
  },
  dati: {
    table: 'datasets', label: 'Dati & infografiche', singular: 'dataset', titleField: 'title', order: 'updated_at DESC',
    publicPath: (r) => `/dati/${r.slug}`, columns: [['title', 'Titolo'], ['chart_type', 'Grafico'], ['source_name', 'Fonte'], ['views', 'Viste'], ['status', 'Stato']],
    help: 'Incolla i dati in CSV: prima riga intestazioni, prima colonna etichette, colonne successive = serie (max 8). Ogni dataset genera pagina, SVG incorporabile (link building), CSV scaricabile e schema Dataset. Shortcode: [[chart:slug]]',
    fields: [
      ['title', 'Titolo', 'text', { required: true }], ['slug', 'Slug URL', 'slug'], ['insight', 'Dato chiave in una frase (risposta rapida)', 'text'],
      ['chart_type', 'Tipo di grafico', 'select', { options: [['bar', 'Colonne'], ['hbar', 'Barre orizzontali (classifiche)'], ['line', 'Linee (andamento nel tempo)'], ['donut', 'Ciambella (parti di un totale)']] }],
      ['data_csv', 'Dati (CSV)', 'csv'], ['unit', 'Unità di misura', 'text', { placeholder: '%, €, milioni…' }],
      ['description_md', 'Analisi e metodologia (Markdown)', 'markdown'], ['source_name', 'Nome fonte', 'text', { placeholder: 'ISTAT, Eurostat, OCSE…' }], ['source_url', 'URL fonte', 'url'],
      ['period', 'Periodo coperto', 'text', { placeholder: '2020-2025' }], ['license', 'Licenza', 'text', { placeholder: 'CC BY 4.0' }],
      ['category_id', 'Categoria', 'select', { options: () => [['', '— nessuna —'], ...db.all('SELECT id, name FROM categories ORDER BY name').map((c) => [String(c.id), c.name])] }],
      ['verified', 'Dati verificati sulla fonte ufficiale', 'checkbox'], ['status', 'Stato', 'select', { options: STATUS }],
    ],
  },
  glossario: {
    table: 'glossary', label: 'Glossario', singular: 'termine', titleField: 'term', order: 'term COLLATE NOCASE',
    publicPath: (r) => `/glossario/${r.slug}`, columns: [['term', 'Termine'], ['short_def', 'Definizione']],
    help: 'Le definizioni brevi (1-2 frasi, max 300 caratteri) sono perfette per featured snippet e risposte AI. Inizia con "X è…".',
    fields: [['term', 'Termine', 'text', { required: true }], ['slug', 'Slug URL', 'slug'], ['short_def', 'Definizione breve', 'textarea'], ['content_md', 'Approfondimento (Markdown)', 'markdown']],
  },
  pagine: {
    table: 'pages', label: 'Pagine', singular: 'pagina', titleField: 'title', order: 'title',
    publicPath: (r) => `/p/${r.slug}`, columns: [['title', 'Titolo'], ['slug', 'Slug'], ['in_footer', 'Nel footer']],
    fields: [['title', 'Titolo', 'text', { required: true }], ['slug', 'Slug URL', 'slug'], ['meta_description', 'Meta description', 'text'], ['content_md', 'Contenuto (Markdown)', 'markdown'], ['in_footer', 'Mostra nel footer', 'checkbox']],
  },
  categorie: {
    table: 'categories', label: 'Categorie', singular: 'categoria', titleField: 'name', order: 'sort, name',
    publicPath: (r) => `/categoria/${r.slug}`, columns: [['name', 'Nome'], ['slug', 'Slug'], ['sort', 'Ordine']],
    fields: [['name', 'Nome', 'text', { required: true }], ['slug', 'Slug URL', 'slug'], ['description', 'Descrizione (intro pagina)', 'textarea'], ['color', 'Colore', 'color'], ['sort', 'Ordine nel menu', 'number'], ['meta_title', 'Meta title', 'text'], ['meta_description', 'Meta description', 'text']],
  },
  redirect: {
    table: 'redirects', label: 'Redirect 301', singular: 'redirect', titleField: 'from_path', order: 'id DESC', noSlug: true,
    columns: [['from_path', 'Da'], ['to_path', 'A'], ['hits', 'Utilizzi']],
    help: 'I redirect vengono creati in automatico quando cambi lo slug di un contenuto pubblicato. Usa percorsi relativi (es. /vecchio-url).',
    fields: [['from_path', 'Percorso di origine', 'text', { required: true, placeholder: '/vecchio-url' }], ['to_path', 'Destinazione', 'text', { required: true, placeholder: '/articoli/nuovo-url' }]],
  },
};
const resolveOptions = (fields) => fields.map(([n, l, t, o = {}]) => [n, l, t, { ...o, options: typeof o.options === 'function' ? o.options() : o.options }]);

router.get('/:entity(strumenti|modelli|dati|glossario|pagine|categorie|redirect)', (req, res) => {
  const E = ENTITIES[req.params.entity];
  const rows = db.all(`SELECT * FROM ${E.table} ORDER BY ${E.order}`);
  res.render('admin/entity-list', { title: E.label, E, key: req.params.entity, rows });
});
router.get('/:entity(strumenti|modelli|dati|glossario|pagine|categorie|redirect)/:id(\\d+|nuovo)', (req, res) => {
  const E = ENTITIES[req.params.entity];
  const row = req.params.id === 'nuovo' ? { status: 'published' } : db.get(`SELECT * FROM ${E.table} WHERE id = ?`, req.params.id);
  if (!row) return back(res, `/admin/${req.params.entity}`, 'Elemento non trovato', true);
  let preview = '';
  if (E.table === 'datasets' && row.data_csv) preview = charts.renderChart(row);
  res.render('admin/entity-form', { title: row.id ? `Modifica ${E.singular}` : `Nuovo ${E.singular}`, E, key: req.params.entity, row, fields: resolveOptions(E.fields), preview });
});
router.post('/:entity(strumenti|modelli|dati|glossario|pagine|categorie|redirect)/salva', auth.requireRole('admin', 'editor'), (req, res) => {
  const key = req.params.entity;
  const E = ENTITIES[key];
  const b = req.body;
  const id = Number(b.id) || 0;
  const old = id ? db.get(`SELECT * FROM ${E.table} WHERE id = ?`, id) : null;
  const rec = {};
  for (const [name, , type, opts = {}] of E.fields) {
    let v = b[name];
    if (type === 'checkbox') v = v ? 1 : 0;
    else if (type === 'number') v = v === '' || v === undefined ? null : Number(v);
    else if (type === 'slug') continue;
    else v = v === undefined ? null : String(v).trim();
    if (opts.required && (v === null || v === '')) return back(res, `/admin/${key}/${id || 'nuovo'}`, `Il campo "${name}" è obbligatorio`, true);
    if (name.endsWith('_id')) v = Number(v) || null;
    rec[name] = v;
  }
  if (!E.noSlug) rec.slug = uniqueSlug(E.table, b.slug || rec[E.titleField], id);
  if (['tools', 'ai_models', 'datasets', 'glossary', 'pages'].includes(E.table)) rec.updated_at = nowIso();
  if (E.table === 'datasets' && !old?.published_at) rec.published_at = nowIso();
  if (E.table === 'redirects') {
    rec.from_path = '/' + String(rec.from_path).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
    if (rec.from_path === rec.to_path) return back(res, `/admin/${key}/${id || 'nuovo'}`, 'Origine e destinazione coincidono', true);
  }
  const cols = Object.keys(rec);
  let rid = id;
  try {
    if (id) db.run(`UPDATE ${E.table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`, { ...rec, id });
    else rid = Number(db.run(`INSERT INTO ${E.table}(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, rec).lastInsertRowid);
  } catch (e) {
    return back(res, `/admin/${key}/${id || 'nuovo'}`, 'Errore di salvataggio: ' + e.message, true);
  }
  if (old && E.publicPath && old.slug !== rec.slug) addRedirect(E.publicPath(old), E.publicPath(rec));
  afterWrite();
  if (E.publicPath && rec.status !== 'draft') indexnow.ping([E.publicPath(rec)]).catch(() => {});
  back(res, `/admin/${key}/${rid}`, 'Salvato');
});
router.post('/:entity(strumenti|modelli|dati|glossario|pagine|categorie|redirect)/:id(\\d+)/elimina', auth.requireRole('admin', 'editor'), (req, res) => {
  const E = ENTITIES[req.params.entity];
  db.run(`DELETE FROM ${E.table} WHERE id = ?`, req.params.id);
  afterWrite();
  back(res, `/admin/${req.params.entity}`, 'Eliminato');
});
router.post('/api/grafico', (req, res) => {
  res.json({ svg: charts.renderChart({ title: req.body.title || 'Anteprima', slug: 'preview', chart_type: req.body.chart_type, data_csv: req.body.data_csv, unit: req.body.unit, source_name: req.body.source_name }) });
});
router.post('/api/markdown', (req, res) => res.json({ html: renderPlain(String(req.body.content || '')) }));

// ------------------------------------------------------------------ Media
router.get('/media', (req, res) => {
  res.render('admin/media', { title: 'Libreria media', list: db.all('SELECT * FROM media ORDER BY id DESC LIMIT 500') });
});
router.post('/media/:id(\\d+)/alt', (req, res) => {
  db.run('UPDATE media SET alt = ? WHERE id = ?', String(req.body.alt || '').slice(0, 300), req.params.id);
  back(res, '/admin/media', 'Testo alternativo aggiornato');
});
router.post('/media/:id(\\d+)/elimina', auth.requireRole('admin', 'editor'), (req, res) => {
  const m = db.get('SELECT filename FROM media WHERE id = ?', req.params.id);
  if (m) {
    const file = path.join(config.uploadsDir, path.basename(m.filename));
    fs.rm(file, { force: true }, () => {});
    db.run('DELETE FROM media WHERE id = ?', req.params.id);
  }
  back(res, '/admin/media', 'File eliminato');
});

// ------------------------------------------------------------------ Iscritti newsletter
router.get('/iscritti', auth.requireRole('admin', 'editor'), (req, res) => {
  const list = db.all('SELECT * FROM subscribers ORDER BY id DESC LIMIT 1000');
  const bySource = db.all('SELECT COALESCE(NULLIF(source, \'\'), \'—\') source, COUNT(*) n FROM subscribers GROUP BY source ORDER BY n DESC');
  res.render('admin/subscribers', { title: 'Iscritti newsletter', list, bySource, total: db.get('SELECT COUNT(*) n FROM subscribers').n });
});
router.get('/iscritti/export.csv', auth.requireRole('admin'), (req, res) => {
  const rows = db.all('SELECT email, source, consent_at FROM subscribers ORDER BY id');
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  res.type('text/csv').set('Content-Disposition', `attachment; filename="iscritti-${today()}.csv"`)
    .send('email,source,consent_at\n' + rows.map((r) => [r.email, r.source, r.consent_at].map(q).join(',')).join('\n'));
});
router.post('/iscritti/:id(\\d+)/elimina', auth.requireRole('admin'), (req, res) => {
  db.run('DELETE FROM subscribers WHERE id = ?', req.params.id);
  back(res, '/admin/iscritti', 'Iscritto rimosso');
});

// ------------------------------------------------------------------ Utenti / autori
router.get('/utenti', auth.requireRole('admin'), (req, res) => {
  res.render('admin/users', { title: 'Utenti e autori', list: db.all('SELECT u.*, (SELECT COUNT(*) FROM articles WHERE author_id = u.id) n FROM users u ORDER BY name') });
});
router.get('/utenti/:id(\\d+|nuovo|profilo)', (req, res) => {
  const isSelf = req.params.id === 'profilo' || Number(req.params.id) === req.user.id;
  if (!isSelf && req.user.role !== 'admin') return back(res, '/admin', 'Permesso negato', true);
  const u = req.params.id === 'nuovo' ? { role: 'author' } : db.get('SELECT * FROM users WHERE id = ?', isSelf ? req.user.id : req.params.id);
  if (!u) return back(res, '/admin/utenti', 'Utente non trovato', true);
  res.render('admin/user-form', { title: u.id ? `Profilo: ${u.name}` : 'Nuovo utente', u, isSelf });
});
router.post('/utenti/salva', (req, res) => {
  const b = req.body;
  const id = Number(b.id) || 0;
  const isSelf = id === req.user.id;
  if (!isSelf && req.user.role !== 'admin') return back(res, '/admin', 'Permesso negato', true);
  const ret = id ? `/admin/utenti/${id}` : '/admin/utenti/nuovo';
  const email = String(b.email || '').trim().toLowerCase();
  if (!b.name || !/^[^\s@]+@[^\s@]+$/.test(email)) return back(res, ret, 'Nome ed email validi sono obbligatori', true);
  if (db.get('SELECT id FROM users WHERE email = ? AND id != ?', email, id)) return back(res, ret, 'Email già in uso', true);
  if (!id && String(b.password || '').length < 10) return back(res, ret, 'La password deve avere almeno 10 caratteri', true);
  const rec = {
    name: b.name.trim(), email, slug: uniqueSlug('users', b.slug || b.name, id), job_title: b.job_title || '', bio: b.bio || '',
    expertise: b.expertise || '', avatar: b.avatar || '', same_as: b.same_as || '',
  };
  if (req.user.role === 'admin' && !isSelf) rec.role = ['admin', 'editor', 'author'].includes(b.role) ? b.role : 'author';
  if (b.password) {
    if (String(b.password).length < 10) return back(res, ret, 'La password deve avere almeno 10 caratteri', true);
    rec.password_hash = auth.hashPassword(b.password);
  }
  const cols = Object.keys(rec);
  let uid = id;
  if (id) db.run(`UPDATE users SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`, { ...rec, id });
  else uid = Number(db.run(`INSERT INTO users(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, { role: 'author', ...rec }).lastInsertRowid);
  if (b.password && id) db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', id, req.sessionId || '');
  afterWrite();
  back(res, isSelf ? '/admin/utenti/profilo' : `/admin/utenti/${uid}`, 'Utente salvato');
});
router.post('/utenti/:id(\\d+)/elimina', auth.requireRole('admin'), (req, res) => {
  if (Number(req.params.id) === req.user.id) return back(res, '/admin/utenti', 'Non puoi eliminare te stesso', true);
  db.run('DELETE FROM users WHERE id = ?', req.params.id);
  afterWrite();
  back(res, '/admin/utenti', 'Utente eliminato');
});

// ------------------------------------------------------------------ Impostazioni
const SETTINGS_GROUPS = [
  ['Identità del sito', [['site_name', 'Nome del sito'], ['site_tagline', 'Slogan'], ['site_description', 'Descrizione (meta e llms.txt)', 'textarea'], ['site_language', 'Lingua (es. it-IT)'], ['organization_name', 'Nome editore / organizzazione'], ['contact_email', 'Email redazione'], ['default_og_image', 'Immagine social predefinita (1200×630)'], ['social_profiles', 'Profili social ufficiali (uno per riga, per schema sameAs)', 'textarea'], ['twitter_handle', 'Account X/Twitter (senza @)']]],
  ['Monetizzazione', [['affiliate_disclosure', 'Avviso affiliazione (mostrato negli articoli con link affiliati)', 'textarea'], ['auto_affiliate_links', 'Auto-link affiliati nelle parole chiave', 'bool'], ['auto_affiliate_max', 'Massimo auto-link per articolo'], ['affiliate_conversion_rate', 'Tasso di conversione stimato % (per la stima ricavi)'], ['adsense_client', 'Google AdSense client ID (ca-pub-…)'], ['ad_slot_header', 'Slot annuncio header'], ['ad_slot_article', 'Slot annuncio in-article'], ['ad_slot_sidebar', 'Slot annuncio sidebar'], ['ad_in_article_after', 'Inserisci annuncio dopo il paragrafo n° (0 = mai)']]],
  ['SEO · GEO · AEO', [['allow_ai_crawlers', 'Consenti ai motori di risposta AI (ChatGPT Search, Perplexity, Claude…) di leggere e citare il sito', 'bool'], ['allow_ai_training', 'Consenti l\'uso dei contenuti per addestrare modelli AI', 'bool'], ['llms_intro', 'Presentazione per gli LLM (llms.txt)', 'textarea'], ['indexnow_enabled', 'Notifica IndexNow (Bing, Yandex…) a ogni pubblicazione', 'bool'], ['indexnow_key', 'Chiave IndexNow'], ['google_site_verification', 'Google Search Console: codice verifica'], ['bing_site_verification', 'Bing Webmaster: codice verifica']]],
  ['Newsletter', [['newsletter_title', 'Titolo box newsletter'], ['newsletter_text', 'Testo box newsletter', 'textarea']]],
  ['Analytics e codice personalizzato', [['plausible_domain', 'Plausible Analytics: dominio (senza cookie, consigliato)'], ['ga4_id', 'Google Analytics 4: ID (G-…), caricato solo dopo consenso'], ['head_code', 'Codice extra in <head> (es. CMP certificata Google per AdSense)', 'code'], ['body_end_code', 'Codice extra prima di </body>', 'code']]],
];
router.get('/impostazioni', auth.requireRole('admin'), (req, res) => {
  res.render('admin/settings', { title: 'Impostazioni', groups: SETTINGS_GROUPS, s: settings.all(), siteUrl: config.siteUrl });
});
router.post('/impostazioni', auth.requireRole('admin'), (req, res) => {
  const out = {};
  for (const [, fields] of SETTINGS_GROUPS) {
    for (const [k, , type] of fields) out[k] = type === 'bool' ? (req.body[k] ? '1' : '0') : (req.body[k] ?? '');
  }
  settings.set(out);
  afterWrite();
  back(res, '/admin/impostazioni', 'Impostazioni salvate');
});

// ------------------------------------------------------------------ Strumenti SEO (audit globale)
router.get('/seo', (req, res) => {
  const rows = db.all(`SELECT a.id, a.title, a.slug, a.status, a.seo_score, a.aeo_score, a.geo_score, a.word_count, a.focus_keyword, a.meta_description, a.cover_image, a.tldr, a.faq, a.sources
    FROM articles a ORDER BY (a.seo_score + a.aeo_score + a.geo_score) ASC`);
  const dupKw = db.all("SELECT focus_keyword, COUNT(*) n FROM articles WHERE focus_keyword != '' GROUP BY lower(focus_keyword) HAVING n > 1");
  const issues = {
    noKeyword: rows.filter((r) => !r.focus_keyword).length,
    noDesc: rows.filter((r) => !r.meta_description).length,
    noCover: rows.filter((r) => !r.cover_image).length,
    noTldr: rows.filter((r) => !r.tldr).length,
    noFaq: rows.filter((r) => (r.faq || '[]') === '[]').length,
    noSources: rows.filter((r) => (r.sources || '[]') === '[]').length,
    thin: rows.filter((r) => r.word_count < 300).length,
  };
  const avg = (k) => (rows.length ? Math.round(rows.reduce((a, r) => a + (r[k] || 0), 0) / rows.length) : 0);
  res.render('admin/seo', { title: 'Centro SEO · GEO · AEO', rows, dupKw, issues, avg: { seo: avg('seo_score'), aeo: avg('aeo_score'), geo: avg('geo_score') }, siteUrl: config.siteUrl });
});
router.post('/seo/ricalcola', auth.requireRole('admin', 'editor'), (req, res) => {
  const all = db.all('SELECT * FROM articles');
  db.tx(() => {
    for (const a of all) {
      const sc = C.scoreArticle(a, db.get('SELECT bio FROM users WHERE id = ?', a.author_id));
      db.run('UPDATE articles SET seo_score = ?, aeo_score = ?, geo_score = ?, word_count = ?, reading_time = ? WHERE id = ?', sc.seo, sc.aeo, sc.geo, sc.wordCount, sc.readingTime, a.id);
      C.syncFts(a);
    }
  });
  afterWrite();
  back(res, '/admin/seo', `Ricalcolati ${all.length} articoli e reindicizzata la ricerca`);
});

module.exports = router;
