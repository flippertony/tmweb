'use strict';
/**
 * Popola il database con contenuti dimostrativi.
 *   npm run seed            → solo se il database è vuoto
 *   npm run seed -- --force → svuota i contenuti (non utenti admin e impostazioni) e ricarica
 * Variabili opzionali: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME per creare l'amministratore senza wizard.
 */
const db = require('./index');
const C = require('../lib/content');
const auth = require('../lib/auth');
const settings = require('../lib/settings');
const { slugify } = require('../lib/utils');
const data = require('./seed-content');

const force = process.argv.includes('--force');
const hasContent = db.get('SELECT COUNT(*) n FROM articles').n > 0;
if (hasContent && !force) {
  console.log('Il database contiene già articoli. Usa "npm run seed -- --force" per ricaricare i contenuti demo.');
  process.exit(0);
}

db.tx(() => {
  if (force) {
    for (const t of ['article_tools', 'article_tags', 'tags', 'clicks', 'articles', 'tools', 'ai_models', 'datasets', 'glossary', 'pages', 'categories', 'redirects', 'daily_stats']) db.run(`DELETE FROM ${t}`);
    db.run('DELETE FROM articles_fts');
  }

  // Amministratore da variabili d'ambiente (deploy automatizzati)
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !db.get('SELECT id FROM users WHERE email = ?', process.env.ADMIN_EMAIL.toLowerCase())) {
    const name = process.env.ADMIN_NAME || 'Amministratore';
    db.run('INSERT INTO users(email, name, slug, password_hash, role) VALUES (?, ?, ?, ?, ?)', process.env.ADMIN_EMAIL.toLowerCase(), name, slugify(name), auth.hashPassword(process.env.ADMIN_PASSWORD), 'admin');
    console.log('Creato amministratore', process.env.ADMIN_EMAIL);
  }

  // Autore redazionale (senza accesso al pannello finché non gli assegni una password)
  let author = db.get("SELECT * FROM users WHERE slug = 'redazione'");
  if (!author) {
    db.run(`INSERT INTO users(email, name, slug, password_hash, role, job_title, bio, expertise, same_as) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'redazione@trendmind.local', 'Redazione TrendMind', 'redazione', '!', 'editor', 'Team editoriale',
      'La redazione di TrendMind segue ogni giorno intelligenza artificiale, tecnologia e mercato digitale, con un approccio basato su fonti primarie e dati verificati.',
      'Intelligenza artificiale, Modelli linguistici, SEO e GEO, Economia digitale, Creator economy', '');
    author = db.get("SELECT * FROM users WHERE slug = 'redazione'");
  }

  const catId = {};
  for (const c of data.categories) {
    const r = db.run('INSERT INTO categories(name, slug, description, color, sort) VALUES (?, ?, ?, ?, ?)', c.name, c.slug, c.description, c.color, c.sort);
    catId[c.slug] = Number(r.lastInsertRowid);
  }

  const toolId = {};
  for (const t of data.tools) {
    const cols = Object.keys(t);
    const r = db.run(`INSERT INTO tools(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, t);
    toolId[t.slug] = Number(r.lastInsertRowid);
  }

  for (const m of data.models) {
    const rec = { ...m, verified: 0, tool_id: null };
    const cols = Object.keys(rec);
    db.run(`INSERT INTO ai_models(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, rec);
  }

  const now = Date.now();
  for (const d of data.datasets) {
    const { category, ...rest } = d;
    const rec = { ...rest, category_id: catId[category] || null, verified: 0, published_at: new Date(now - 864e5).toISOString() };
    const cols = Object.keys(rec);
    db.run(`INSERT INTO datasets(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, rec);
  }

  for (const [term, def] of data.glossary) {
    db.run('INSERT INTO glossary(term, slug, short_def, content_md) VALUES (?, ?, ?, ?)', term, slugify(term), def, '');
  }

  for (const p of data.pages) {
    db.run('INSERT INTO pages(title, slug, content_md, meta_description, in_footer) VALUES (?, ?, ?, ?, 1)', p.title, p.slug, p.content_md, p.meta_description);
  }

  for (const a of data.articles) {
    const date = new Date(now - a.daysAgo * 864e5).toISOString();
    const rec = {
      title: a.title, slug: a.slug, type: a.type, excerpt: a.excerpt, tldr: a.tldr, takeaways: a.takeaways, content_md: a.content_md,
      faq: JSON.stringify(a.faq || []), steps: JSON.stringify(a.steps || []), sources: JSON.stringify(a.sources || []),
      category_id: catId[a.category], author_id: author.id, cover_image: '', cover_alt: '', status: 'published', featured: a.featured || 0,
      sponsored: 0, focus_keyword: a.focus_keyword, meta_title: a.meta_title, meta_description: a.meta_description,
      canonical_url: '', noindex: 0, published_at: date, updated_at: date, created_at: date, views: Math.round(40 + Math.random() * 400),
    };
    const sc = C.scoreArticle(rec, author);
    Object.assign(rec, { word_count: sc.wordCount, reading_time: sc.readingTime, seo_score: sc.seo, aeo_score: sc.aeo, geo_score: sc.geo });
    const cols = Object.keys(rec);
    const id = Number(db.run(`INSERT INTO articles(${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`, rec).lastInsertRowid);
    (a.tools || []).forEach((slug, i) => toolId[slug] && db.run('INSERT INTO article_tools(article_id, tool_id, sort) VALUES (?, ?, ?)', id, toolId[slug], i));
    const tagNames = [a.focus_keyword, data.categories.find((c) => c.slug === a.category)?.name].filter(Boolean);
    for (const name of tagNames) {
      const slug = slugify(name);
      db.run('INSERT OR IGNORE INTO tags(name, slug) VALUES (?, ?)', name, slug);
      db.run('INSERT OR IGNORE INTO article_tags(article_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE slug = ?))', id, slug);
    }
    C.syncFts({ ...rec, id });
    console.log(`  ✓ ${a.title}  [SEO ${sc.seo} · AEO ${sc.aeo} · GEO ${sc.geo}]`);
  }
});

settings.ensureIndexNowKey();
console.log('\nContenuti demo caricati. Avvia con "npm start" e apri /admin per configurare l\'amministratore.');
