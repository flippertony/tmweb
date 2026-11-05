'use strict';
const express = require('express');
const db = require('../db');
const C = require('../lib/content');
const seo = require('../lib/seo');
const settings = require('../lib/settings');
const charts = require('../lib/charts');
const comp = require('../lib/components');
const { renderPlain } = require('../lib/markdown');
const { rateLimit } = require('../lib/auth');
const { lines, stripMd, truncate, nowIso } = require('../lib/utils');
const config = require('../config');

const router = express.Router();
const PER_PAGE = 12;
const page = (req) => Math.max(1, parseInt(req.query.pagina, 10) || 1);
const notFound = (res) => res.status(404).render('404', { meta: seo.meta({ title: 'Pagina non trovata', noindex: true, path: '/404' }) });

function pagination(base, current, total) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const url = (n) => (n <= 1 ? base : `${base}?pagina=${n}`);
  return { current, pages, prev: current > 1 ? url(current - 1) : null, next: current < pages ? url(current + 1) : null, url };
}

// ---------------- Home
router.get('/', (req, res) => {
  const featured = C.listArticles({ featured: true, limit: 1 });
  const exclude = featured.map((a) => a.id);
  const latest = C.listArticles({ limit: 9, exclude });
  const trending = C.listArticles({ order: 'trending', limit: 5 });
  const cats = db.all('SELECT * FROM categories ORDER BY sort, name');
  const sections = cats.slice(0, 4).map((c) => ({ cat: c, items: C.listArticles({ categoryId: c.id, limit: 4 }) })).filter((s) => s.items.length);
  const models = C.models.all().slice(0, 6);
  const topTools = C.tools.all().slice(0, 4);
  const datasets = C.datasets.all().slice(0, 2).map((d) => ({ ...d, svg: C.chartSvg(d) }));
  const s = settings.all();
  res.render('home', {
    featured: featured[0] || latest.shift(), latest, trending, sections, models, topTools, datasets,
    meta: seo.meta({
      title: `${s.site_name} — ${s.site_tagline}`, rawTitle: true, path: '/',
      nodes: [{
        '@type': 'CollectionPage', '@id': config.siteUrl + '/#webpage', url: config.siteUrl + '/', name: s.site_name,
        about: ['Intelligenza artificiale', 'Modelli AI', 'Tecnologia', 'Guadagnare online'], isPartOf: { '@id': seo.SITE_ID() },
      }],
    }),
  });
});

// ---------------- Archivio articoli
router.get('/articoli', (req, res) => {
  const p = page(req);
  const total = C.countArticles();
  const items = C.listArticles({ limit: PER_PAGE, offset: (p - 1) * PER_PAGE });
  if (p > 1 && !items.length) return notFound(res);
  const pg = pagination('/articoli', p, total);
  res.render('list', {
    heading: 'Tutti gli articoli', intro: 'Le ultime news e analisi su AI, tecnologia e opportunità digitali.', items, pg,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Articoli', url: '/articoli' }],
    meta: seo.meta({ title: p > 1 ? `Articoli — pagina ${p}` : 'Ultimi articoli su AI e tecnologia', path: pg.url(p), prev: pg.prev, next: pg.next, nodes: [seo.breadcrumb([{ name: 'Home', url: '/' }, { name: 'Articoli', url: '/articoli' }])] }),
  });
});

// Versione Markdown dell'articolo (GEO: pensata per crawler e agenti AI)
router.get('/articoli/:slug.md', (req, res) => {
  const a = C.getArticle(req.params.slug);
  if (!a || a.noindex) return notFound(res);
  res.type('text/markdown; charset=utf-8').send(articleMarkdown(a));
});

router.get('/articoli/:slug', (req, res, next) => {
  const preview = req.query.anteprima === '1' && req.isEditor;
  const a = C.getArticle(req.params.slug, { preview });
  if (!a) return next();
  if (!preview) C.incrementViews('articles', a.id);
  const body = C.renderBody(a);
  const url = seo.abs(`/articoli/${a.slug}`);
  const crumbs = [{ name: 'Home', url: '/' }];
  if (a.category_slug) crumbs.push({ name: a.category_name, url: `/categoria/${a.category_slug}` });
  crumbs.push({ name: a.title, url: `/articoli/${a.slug}` });
  res.render('article', {
    a, body, crumbs, related: C.related(a), preview,
    meta: seo.meta({
      title: a.meta_title || a.title, path: `/articoli/${a.slug}`, canonical: a.canonical_url || `/articoli/${a.slug}`,
      description: a.meta_description || a.excerpt || stripMd(a.tldr), type: 'article',
      image: a.cover_image, imageAlt: a.cover_alt, noindex: a.noindex || preview || a.status !== 'published',
      publishedAt: a.published_at, modifiedAt: a.updated_at, section: a.category_name, tags: a.tags.map((t) => t.name),
      authorName: a.author?.name, markdownAlt: `/articoli/${a.slug}.md`,
      nodes: [seo.article(a, { faq: a.faqList, steps: a.stepList, sources: a.sourceList, tags: a.tags, url }), seo.breadcrumb(crumbs)],
    }),
  });
});

function articleMarkdown(a) {
  const s = settings.all();
  const out = [`# ${a.title}`, '', `> ${a.tldr || a.excerpt || ''}`, '',
    `- URL: ${seo.abs('/articoli/' + a.slug)}`, `- Pubblicato: ${a.published_at}`, `- Aggiornato: ${a.updated_at}`,
    `- Autore: ${a.author?.name || s.site_name}`, `- Categoria: ${a.category_name || ''}`, ''];
  if (a.takeawayList.length) out.push('## Punti chiave', '', ...a.takeawayList.map((t) => `- ${t}`), '');
  out.push(String(a.content_md || '').replace(/\[\[[^\]]+\]\]/g, ''), '');
  if (a.stepList.length) out.push('## Passaggi', '', ...a.stepList.map((st, i) => `${i + 1}. **${st.name}** — ${st.text}`), '');
  if (a.faqList.length) out.push('## Domande frequenti', '', ...a.faqList.flatMap((f) => [`### ${f.q}`, '', f.a, '']));
  if (a.sourceList.length) out.push('## Fonti', '', ...a.sourceList.map((x) => `- [${x.title || x.url}](${x.url})${x.publisher ? ' — ' + x.publisher : ''}`), '');
  return out.join('\n');
}

// ---------------- Categorie, tag, autori
router.get('/categoria/:slug', (req, res, next) => {
  const cat = db.get('SELECT * FROM categories WHERE slug = ?', req.params.slug);
  if (!cat) return next();
  const p = page(req);
  const total = C.countArticles({ categoryId: cat.id });
  const items = C.listArticles({ categoryId: cat.id, limit: PER_PAGE, offset: (p - 1) * PER_PAGE });
  if (p > 1 && !items.length) return notFound(res);
  const pg = pagination(`/categoria/${cat.slug}`, p, total);
  const crumbs = [{ name: 'Home', url: '/' }, { name: cat.name, url: `/categoria/${cat.slug}` }];
  res.render('list', {
    heading: cat.name, intro: cat.description, items, pg, crumbs, category: cat,
    datasets: C.datasets.all().filter((d) => d.category_id === cat.id).slice(0, 2).map((d) => ({ ...d, svg: C.chartSvg(d) })),
    meta: seo.meta({
      title: (cat.meta_title || cat.name) + (p > 1 ? ` — pagina ${p}` : ''), description: cat.meta_description || cat.description,
      path: pg.url(p), prev: pg.prev, next: pg.next,
      nodes: [seo.breadcrumb(crumbs), itemList(items, `/categoria/${cat.slug}`)],
    }),
  });
});

router.get('/tag/:slug', (req, res, next) => {
  const tag = db.get('SELECT * FROM tags WHERE slug = ?', req.params.slug);
  if (!tag) return next();
  const p = page(req);
  const total = C.countArticles({ tagId: tag.id });
  const items = C.listArticles({ tagId: tag.id, limit: PER_PAGE, offset: (p - 1) * PER_PAGE });
  const pg = pagination(`/tag/${tag.slug}`, p, total);
  const crumbs = [{ name: 'Home', url: '/' }, { name: `#${tag.name}`, url: `/tag/${tag.slug}` }];
  res.render('list', {
    heading: `#${tag.name}`, intro: `Tutti gli articoli su ${tag.name}.`, items, pg, crumbs,
    // i tag con pochi contenuti non vengono indicizzati (evita thin content)
    meta: seo.meta({ title: `${tag.name}: news e approfondimenti`, path: pg.url(p), noindex: total < 3, prev: pg.prev, next: pg.next, nodes: [seo.breadcrumb(crumbs)] }),
  });
});

router.get('/autore/:slug', (req, res, next) => {
  const u = db.get('SELECT id, name, slug, job_title, bio, expertise, avatar, same_as FROM users WHERE slug = ?', req.params.slug);
  if (!u) return next();
  const p = page(req);
  const total = C.countArticles({ authorId: u.id });
  const items = C.listArticles({ authorId: u.id, limit: PER_PAGE, offset: (p - 1) * PER_PAGE });
  const pg = pagination(`/autore/${u.slug}`, p, total);
  const crumbs = [{ name: 'Home', url: '/' }, { name: u.name, url: `/autore/${u.slug}` }];
  res.render('author', {
    u, items, pg, crumbs, total, links: lines(u.same_as),
    meta: seo.meta({
      title: `${u.name}${u.job_title ? ', ' + u.job_title : ''}`, description: u.bio, path: pg.url(p), type: 'profile', image: u.avatar,
      nodes: [{ '@type': 'ProfilePage', '@id': seo.abs(`/autore/${u.slug}`), url: seo.abs(`/autore/${u.slug}`), mainEntity: { '@id': seo.abs(`/autore/${u.slug}`) + '#person' } }, seo.person(u), seo.breadcrumb(crumbs)],
    }),
  });
});

function itemList(items, path) {
  return {
    '@type': 'ItemList', '@id': seo.abs(path) + '#list',
    itemListElement: items.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: seo.abs(`/articoli/${a.slug}`), name: a.title })),
  };
}

// ---------------- Modelli AI
router.get('/modelli-ai', (req, res) => {
  const list = C.models.all();
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Modelli AI', url: '/modelli-ai' }];
  res.render('models', {
    list, crumbs,
    meta: seo.meta({
      title: 'Confronto modelli AI: prezzi, contesto e punti di forza', path: '/modelli-ai',
      description: 'Classifica e confronto dei principali modelli di intelligenza artificiale: costo per token, finestra di contesto, pesi aperti e valutazioni su ragionamento, coding e velocità.',
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'ItemList', '@id': seo.abs('/modelli-ai') + '#list', name: 'Modelli AI a confronto',
        itemListElement: list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: seo.abs(`/modelli-ai/${m.slug}`), name: m.name })),
      }],
    }),
  });
});

router.get('/modelli-ai/confronto', (req, res) => {
  const all = C.models.all();
  const pick = String(req.query.m || '').split(',').filter(Boolean).slice(0, 4);
  const chosen = (pick.length ? pick.map((sl) => all.find((m) => m.slug === sl)).filter(Boolean) : all.slice(0, 3));
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Modelli AI', url: '/modelli-ai' }, { name: 'Confronto', url: '/modelli-ai/confronto' }];
  const names = chosen.map((m) => m.name).join(' vs ');
  res.render('compare', {
    all, chosen, crumbs,
    meta: seo.meta({
      title: chosen.length ? `${names}: confronto completo` : 'Confronta modelli AI', path: '/modelli-ai/confronto' + (pick.length ? `?m=${pick.join(',')}` : ''),
      canonical: '/modelli-ai/confronto' + (pick.length ? `?m=${pick.join(',')}` : ''), noindex: pick.length > 2,
      description: `Confronto affiancato tra ${names}: prezzi per milione di token, finestra di contesto, modalità e valutazioni.`,
      nodes: [seo.breadcrumb(crumbs)],
    }),
  });
});

router.get('/modelli-ai/calcolatore-costi', (req, res) => {
  const list = C.models.all().filter((m) => m.input_price != null && m.output_price != null);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Modelli AI', url: '/modelli-ai' }, { name: 'Calcolatore costi', url: '/modelli-ai/calcolatore-costi' }];
  res.render('calculator', {
    list, crumbs,
    meta: seo.meta({
      title: 'Calcolatore costi API AI: quanto spendi al mese?', path: '/modelli-ai/calcolatore-costi',
      description: 'Stima gratis il costo mensile delle API dei modelli AI in base a richieste, token di input e output. Confronto immediato tra provider.',
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'WebApplication', '@id': seo.abs('/modelli-ai/calcolatore-costi') + '#app', name: 'Calcolatore costi API AI',
        applicationCategory: 'BusinessApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      }],
    }),
  });
});

router.get('/modelli-ai/:slug', (req, res, next) => {
  const m = C.models.bySlug(req.params.slug);
  if (!m) return next();
  const tool = m.tool_id ? db.get("SELECT * FROM tools WHERE id = ? AND status = 'published'", m.tool_id) : null;
  const others = C.models.all().filter((x) => x.id !== m.id).slice(0, 4);
  const news = C.search(m.name, 4);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Modelli AI', url: '/modelli-ai' }, { name: m.name, url: `/modelli-ai/${m.slug}` }];
  const faq = [
    m.input_price != null && { q: `Quanto costa ${m.name}?`, a: `Tramite API ${m.name} costa ${m.input_price} dollari per milione di token in input e ${m.output_price} dollari per milione di token in output (dati ${m.verified ? 'verificati' : 'indicativi'}, controlla sempre il listino ufficiale di ${m.provider}).` },
    m.context_window && { q: `Qual è la finestra di contesto di ${m.name}?`, a: `${m.name} gestisce fino a ${Number(m.context_window).toLocaleString('it-IT')} token di contesto, cioè circa ${Math.round(m.context_window * 0.75).toLocaleString('it-IT')} parole.` },
    { q: `${m.name} è open source?`, a: m.open_weights ? `Sì, ${m.name} è distribuito con pesi aperti: puoi scaricarlo ed eseguirlo sui tuoi server, rispettando la licenza.` : `No, ${m.name} è un modello proprietario di ${m.provider}, accessibile tramite app e API.` },
    m.best_for && { q: `Per cosa è più adatto ${m.name}?`, a: m.best_for },
  ].filter(Boolean);
  res.render('model', {
    m, tool, others, news, crumbs, faq, strengths: lines(m.strengths), weaknesses: lines(m.weaknesses), desc: renderPlain(m.description),
    meta: seo.meta({
      title: `${m.name}: prezzi, caratteristiche e alternative`, path: `/modelli-ai/${m.slug}`,
      description: truncate(`${m.name} di ${m.provider}: costo API, finestra di contesto, punti di forza e limiti. ${stripMd(m.description)}`, 160),
      modifiedAt: m.updated_at,
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'SoftwareApplication', '@id': seo.abs(`/modelli-ai/${m.slug}`) + '#software', name: m.name,
        applicationCategory: 'Intelligenza artificiale', operatingSystem: 'Cloud, API',
        author: { '@type': 'Organization', name: m.provider }, datePublished: m.release_date || undefined,
        description: stripMd(m.description), url: m.website || undefined,
        offers: m.input_price != null ? { '@type': 'Offer', price: String(m.input_price), priceCurrency: 'USD', description: 'Prezzo per 1M token di input' } : undefined,
      }, { '@type': 'FAQPage', '@id': seo.abs(`/modelli-ai/${m.slug}`) + '#faq', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }],
    }),
  });
});

// ---------------- Strumenti & affiliazioni
router.get('/strumenti', (req, res) => {
  const cat = req.query.categoria || '';
  const list = C.tools.all().filter((t) => !cat || t.category === cat);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Strumenti', url: '/strumenti' }];
  res.render('tools', {
    list, cats: C.tools.categories(), cat, crumbs,
    meta: seo.meta({
      title: cat ? `Migliori strumenti ${cat}` : 'Migliori strumenti AI e digitali, testati e recensiti', path: '/strumenti' + (cat ? `?categoria=${encodeURIComponent(cat)}` : ''),
      description: 'Selezione indipendente di software AI, tool per creator, hosting e piattaforme per guadagnare online, con valutazioni, pro e contro e codici sconto.',
      nodes: [seo.breadcrumb(crumbs), { '@type': 'ItemList', '@id': seo.abs('/strumenti') + '#list', itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: seo.abs(`/strumenti/${t.slug}`), name: t.name })) }],
    }),
  });
});

router.get('/strumenti/:slug', (req, res, next) => {
  const t = C.tools.bySlug(req.params.slug);
  if (!t) return next();
  const alternatives = db.all("SELECT * FROM tools WHERE status = 'published' AND category = ? AND id != ? ORDER BY rating DESC LIMIT 3", t.category || '', t.id);
  const articles = db.all(`${C.BASE} WHERE ${C.PUB} AND a.id IN (SELECT article_id FROM article_tools WHERE tool_id = ?) ORDER BY a.published_at DESC LIMIT 4`, nowIso(), t.id);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Strumenti', url: '/strumenti' }, { name: t.name, url: `/strumenti/${t.slug}` }];
  const u = seo.abs(`/strumenti/${t.slug}`);
  res.render('tool', {
    t, alternatives, articles, crumbs, pros: lines(t.pros), cons: lines(t.cons), desc: renderPlain(t.description_md),
    meta: seo.meta({
      title: `${t.name}: recensione, prezzi e alternative`, path: `/strumenti/${t.slug}`,
      description: truncate(`${t.name}: ${t.tagline || ''}. Pro, contro, prezzi${t.free_plan ? ', piano gratuito' : ''} e alternative.`, 160),
      image: t.logo, modifiedAt: t.updated_at,
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'SoftwareApplication', '@id': u + '#software', name: t.name, applicationCategory: t.category || 'BusinessApplication', operatingSystem: 'Web',
        description: t.tagline, image: t.logo ? seo.abs(t.logo) : undefined,
        offers: { '@type': 'Offer', price: t.free_plan ? '0' : undefined, priceCurrency: 'EUR', description: t.pricing || undefined },
        review: t.rating ? {
          '@type': 'Review', author: { '@id': seo.ORG_ID() }, reviewRating: { '@type': 'Rating', ratingValue: t.rating, bestRating: 5, worstRating: 1 },
          positiveNotes: lines(t.pros).length ? { '@type': 'ItemList', itemListElement: lines(t.pros).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p })) } : undefined,
          negativeNotes: lines(t.cons).length ? { '@type': 'ItemList', itemListElement: lines(t.cons).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p })) } : undefined,
        } : undefined,
      }],
    }),
  });
});

// Redirect affiliato tracciato
router.get('/go/:slug', (req, res, next) => {
  const t = db.get("SELECT id, affiliate_url, website FROM tools WHERE slug = ? AND status = 'published'", req.params.slug);
  if (!t) return next();
  const dest = t.affiliate_url || t.website;
  if (!dest || !/^https?:\/\//i.test(dest)) return next();
  const ua = String(req.headers['user-agent'] || '');
  if (!/bot|crawl|spider|slurp|preview|fetch/i.test(ua)) {
    let source = '';
    try { source = new URL(req.headers.referer || '').pathname; } catch { /* nessun referer */ }
    db.run('INSERT INTO clicks(tool_id, source) VALUES (?, ?)', t.id, source.slice(0, 200));
    db.run('UPDATE tools SET clicks = clicks + 1 WHERE id = ?', t.id);
    C.trackDaily('click');
  }
  res.set('X-Robots-Tag', 'noindex, nofollow').set('Cache-Control', 'no-store').redirect(302, dest);
});

// ---------------- Dati & infografiche
router.get('/dati', (req, res) => {
  const list = C.datasets.all().map((d) => ({ ...d, svg: C.chartSvg(d) }));
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Dati e infografiche', url: '/dati' }];
  res.render('datasets', {
    list, crumbs,
    meta: seo.meta({
      title: 'Dati e infografiche su AI, tecnologia e lavoro digitale', path: '/dati',
      description: 'Statistiche da fonti ufficiali trasformate in infografiche chiare: adozione dell\'AI, mercato digitale, trend social e lavoro online. Libere da incorporare citando la fonte.',
      nodes: [seo.breadcrumb(crumbs), { '@type': 'DataCatalog', '@id': seo.abs('/dati') + '#catalog', name: 'Catalogo dati', dataset: list.map((d) => ({ '@id': seo.abs(`/dati/${d.slug}`) + '#dataset' })) }],
    }),
  });
});

router.get('/dati/:slug.svg', (req, res, next) => {
  const d = C.datasets.bySlug(req.params.slug);
  if (!d) return next();
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').set('Access-Control-Allow-Origin', '*').send(C.chartSvg(d, { standalone: true }));
});

router.get('/dati/:slug.csv', (req, res, next) => {
  const d = C.datasets.bySlug(req.params.slug);
  if (!d) return next();
  res.type('text/csv; charset=utf-8').set('Content-Disposition', `inline; filename="${d.slug}.csv"`).send(d.data_csv || '');
});

router.get('/dati/:slug', (req, res, next) => {
  const d = C.datasets.bySlug(req.params.slug);
  if (!d) return next();
  C.incrementViews('datasets', d.id);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Dati', url: '/dati' }, { name: d.title, url: `/dati/${d.slug}` }];
  const u = seo.abs(`/dati/${d.slug}`);
  const s = settings.all();
  const embed = `<a href="${u}"><img src="${u}.svg" alt="${d.title.replace(/"/g, '&quot;')}" width="720" loading="lazy"></a><br><small>Infografica: <a href="${u}">${s.site_name}</a>${d.source_name ? ' · Fonte: ' + d.source_name : ''}</small>`;
  const articles = db.all(`${C.BASE} WHERE ${C.PUB} AND a.content_md LIKE ? ORDER BY a.published_at DESC LIMIT 4`, nowIso(), `%[[chart:${d.slug}]]%`);
  res.render('dataset', {
    d, svg: C.chartSvg(d), table: charts.renderTable(d), embed, articles, crumbs, desc: renderPlain(d.description_md),
    meta: seo.meta({
      title: d.title, description: d.insight || stripMd(d.description_md), path: `/dati/${d.slug}`, modifiedAt: d.updated_at,
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'Dataset', '@id': u + '#dataset', name: d.title, description: d.insight || stripMd(d.description_md) || d.title,
        url: u, temporalCoverage: d.period || undefined, license: d.license || undefined, isAccessibleForFree: true,
        creator: { '@id': seo.ORG_ID() }, dateModified: d.updated_at,
        isBasedOn: d.source_url || undefined, citation: d.source_name || undefined,
        distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: u + '.csv' }, { '@type': 'DataDownload', encodingFormat: 'image/svg+xml', contentUrl: u + '.svg' }],
      }],
    }),
  });
});

// ---------------- Glossario
router.get('/glossario', (req, res) => {
  const list = db.all('SELECT * FROM glossary ORDER BY term COLLATE NOCASE');
  const groups = {};
  for (const g of list) { const L = g.term[0].toUpperCase(); (groups[L] ||= []).push(g); }
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Glossario AI', url: '/glossario' }];
  res.render('glossary', {
    groups, crumbs,
    meta: seo.meta({
      title: 'Glossario dell\'intelligenza artificiale: i termini spiegati semplice', path: '/glossario',
      description: 'Definizioni chiare e brevi dei termini di AI, machine learning, SEO e marketing digitale: LLM, token, RAG, GEO, AEO, prompt engineering e molto altro.',
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'DefinedTermSet', '@id': seo.abs('/glossario') + '#set', name: 'Glossario AI',
        hasDefinedTerm: list.map((g) => ({ '@type': 'DefinedTerm', name: g.term, description: g.short_def, url: seo.abs(`/glossario/${g.slug}`) })),
      }],
    }),
  });
});

router.get('/glossario/:slug', (req, res, next) => {
  const g = db.get('SELECT * FROM glossary WHERE slug = ?', req.params.slug);
  if (!g) return next();
  const others = db.all('SELECT term, slug FROM glossary WHERE id != ? ORDER BY RANDOM() LIMIT 8', g.id);
  const articles = C.search(g.term, 4);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Glossario', url: '/glossario' }, { name: g.term, url: `/glossario/${g.slug}` }];
  res.render('term', {
    g, others, articles, crumbs, body: renderPlain(g.content_md),
    meta: seo.meta({
      title: `${g.term}: cos'è e significato`, description: g.short_def, path: `/glossario/${g.slug}`, modifiedAt: g.updated_at,
      nodes: [seo.breadcrumb(crumbs), {
        '@type': 'DefinedTerm', '@id': seo.abs(`/glossario/${g.slug}`) + '#term', name: g.term, description: g.short_def,
        inDefinedTermSet: { '@id': seo.abs('/glossario') + '#set' }, url: seo.abs(`/glossario/${g.slug}`),
      }],
    }),
  });
});

// ---------------- Ricerca
router.get('/cerca', (req, res) => {
  const q = String(req.query.q || '').slice(0, 100);
  const items = q ? C.search(q) : [];
  const terms = q ? db.all('SELECT term, slug, short_def FROM glossary WHERE term LIKE ? LIMIT 3', `%${q}%`) : [];
  const toolHits = q ? db.all("SELECT * FROM tools WHERE status = 'published' AND (name LIKE ? OR category LIKE ?) LIMIT 3", `%${q}%`, `%${q}%`) : [];
  res.render('search', { q, items, terms, toolHits, meta: seo.meta({ title: q ? `Risultati per “${q}”` : 'Cerca', path: '/cerca', noindex: true }) });
});

// ---------------- Pagine statiche
router.get('/p/:slug', (req, res, next) => {
  const p = db.get('SELECT * FROM pages WHERE slug = ?', req.params.slug);
  if (!p) return next();
  const crumbs = [{ name: 'Home', url: '/' }, { name: p.title, url: `/p/${p.slug}` }];
  res.render('page', {
    p, body: renderPlain(p.content_md), crumbs,
    meta: seo.meta({
      title: p.title, description: p.meta_description, path: `/p/${p.slug}`, modifiedAt: p.updated_at,
      nodes: [seo.breadcrumb(crumbs), { '@type': p.slug === 'chi-siamo' ? 'AboutPage' : p.slug === 'contatti' ? 'ContactPage' : 'WebPage', '@id': seo.abs(`/p/${p.slug}`), url: seo.abs(`/p/${p.slug}`), name: p.title }],
    }),
  });
});

// ---------------- Newsletter
router.post('/newsletter', (req, res) => {
  const wantsJson = (req.headers.accept || '').includes('application/json');
  const done = (ok, msg) => (wantsJson ? res.status(ok ? 200 : 400).json({ ok, msg }) : res.redirect(303, (req.headers.referer && new URL(req.headers.referer, config.siteUrl).pathname) || '/'));
  if (req.body.website) return done(true, 'Grazie!'); // honeypot anti-bot
  if (!rateLimit('nl:' + req.ip, 5, 60 * 60 * 1000)) return done(false, 'Troppi tentativi, riprova più tardi.');
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return done(false, 'Inserisci un indirizzo email valido.');
  const r = db.run('INSERT OR IGNORE INTO subscribers(email, source) VALUES (?, ?)', email, String(req.body.source || '').slice(0, 50));
  if (r.changes) C.trackDaily('subscribe');
  done(true, 'Iscrizione completata! Controlla la tua casella il prossimo lunedì.');
});

module.exports = { router, articleMarkdown, notFound };
