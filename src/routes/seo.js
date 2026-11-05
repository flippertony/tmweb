'use strict';
/** Endpoint tecnici SEO/GEO: robots.txt, sitemap, Google News, llms.txt, feed RSS/JSON, IndexNow, manifest. */
const express = require('express');
const db = require('../db');
const C = require('../lib/content');
const settings = require('../lib/settings');
const config = require('../config');
const { esc, nowIso, stripMd, truncate } = require('../lib/utils');
const { articleMarkdown } = require('./public');

const router = express.Router();
const U = (p) => config.siteUrl + p;

// Crawler dei motori generativi: distinguiamo "ricerca/citazione" da "addestramento"
const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'Applebot', 'DuckAssistBot', 'MistralAI-User'];
const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent', 'Bytespider', 'cohere-training-data-crawler'];

router.get('/robots.txt', (req, res) => {
  const s = settings.all();
  const out = ['# robots.txt — ' + s.site_name, 'User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /go/', 'Disallow: /cerca', 'Disallow: /*?anteprima=', ''];
  out.push('# Motori di risposta AI (GEO): ' + (s.allow_ai_crawlers === '1' ? 'consentiti per farsi citare' : 'bloccati'));
  // un gruppo specifico sostituisce quello generico: ripetiamo le esclusioni
  for (const b of AI_SEARCH_BOTS) out.push(`User-agent: ${b}`, ...(s.allow_ai_crawlers === '1' ? ['Allow: /', 'Disallow: /admin', 'Disallow: /go/', 'Disallow: /cerca'] : ['Disallow: /']), '');
  out.push('# Addestramento modelli: ' + (s.allow_ai_training === '1' ? 'consentito' : 'non consentito'));
  for (const b of AI_TRAINING_BOTS) out.push(`User-agent: ${b}`, s.allow_ai_training === '1' ? 'Allow: /' : 'Disallow: /', '');
  out.push(`Sitemap: ${U('/sitemap.xml')}`, `Sitemap: ${U('/sitemap-news.xml')}`, '');
  res.type('text/plain').send(out.join('\n'));
});

function urlset(urls, extraNs = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"${extraNs}>\n`
    + urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.extra || ''}</url>`).join('\n')
    + '\n</urlset>';
}

router.get('/sitemap.xml', (req, res) => {
  const now = nowIso();
  const urls = [{ loc: U('/'), lastmod: now }, { loc: U('/articoli') }, { loc: U('/modelli-ai') }, { loc: U('/modelli-ai/calcolatore-costi') }, { loc: U('/strumenti') }, { loc: U('/dati') }, { loc: U('/glossario') }];
  for (const a of db.all(`SELECT slug, updated_at, cover_image, cover_alt, title FROM articles a WHERE ${C.PUB} AND noindex = 0 AND (canonical_url IS NULL OR canonical_url = '') ORDER BY published_at DESC`, now)) {
    const img = a.cover_image ? `<image:image><image:loc>${esc(a.cover_image.startsWith('http') ? a.cover_image : U(a.cover_image))}</image:loc></image:image>` : '';
    urls.push({ loc: U(`/articoli/${a.slug}`), lastmod: a.updated_at, extra: img });
  }
  for (const c of db.all('SELECT slug FROM categories')) urls.push({ loc: U(`/categoria/${c.slug}`) });
  for (const m of db.all("SELECT slug, updated_at FROM ai_models WHERE status = 'published'")) urls.push({ loc: U(`/modelli-ai/${m.slug}`), lastmod: m.updated_at });
  for (const t of db.all("SELECT slug, updated_at FROM tools WHERE status = 'published'")) urls.push({ loc: U(`/strumenti/${t.slug}`), lastmod: t.updated_at });
  for (const d of db.all("SELECT slug, updated_at FROM datasets WHERE status = 'published'")) urls.push({ loc: U(`/dati/${d.slug}`), lastmod: d.updated_at });
  for (const g of db.all('SELECT slug, updated_at FROM glossary')) urls.push({ loc: U(`/glossario/${g.slug}`), lastmod: g.updated_at });
  for (const u of db.all("SELECT slug FROM users WHERE id IN (SELECT DISTINCT author_id FROM articles WHERE status = 'published')")) urls.push({ loc: U(`/autore/${u.slug}`) });
  for (const p of db.all('SELECT slug, updated_at FROM pages')) urls.push({ loc: U(`/p/${p.slug}`), lastmod: p.updated_at });
  res.type('application/xml').send(urlset(urls));
});

// Google News: solo articoli delle ultime 48 ore
router.get('/sitemap-news.xml', (req, res) => {
  const s = settings.all();
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const rows = db.all(`SELECT slug, title, published_at FROM articles a WHERE ${C.PUB} AND noindex = 0 AND published_at >= ? ORDER BY published_at DESC LIMIT 1000`, nowIso(), since);
  const lang = (s.site_language || 'it').slice(0, 2);
  const urls = rows.map((a) => ({
    loc: U(`/articoli/${a.slug}`),
    extra: `<news:news><news:publication><news:name>${esc(s.site_name)}</news:name><news:language>${lang}</news:language></news:publication><news:publication_date>${a.published_at}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news>`,
  }));
  res.type('application/xml').send(urlset(urls, ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"'));
});

// llms.txt — indice leggibile dagli LLM (proposta llmstxt.org)
router.get('/llms.txt', (req, res) => {
  const s = settings.all();
  const cats = db.all('SELECT * FROM categories ORDER BY sort, name');
  const out = [`# ${s.site_name}`, '', `> ${s.site_description}`, '', s.llms_intro, '',
    'Ogni articolo è disponibile anche in Markdown aggiungendo `.md` all\'URL (es. /articoli/slug.md).', '',
    '## Sezioni principali', '',
    `- [Ultimi articoli](${U('/articoli')}): news e analisi in ordine cronologico`,
    `- [Modelli AI a confronto](${U('/modelli-ai')}): prezzi, contesto e valutazioni dei modelli`,
    `- [Calcolatore costi API](${U('/modelli-ai/calcolatore-costi')}): stima della spesa mensile`,
    `- [Dati e infografiche](${U('/dati')}): statistiche con fonte, scaricabili in CSV`,
    `- [Strumenti](${U('/strumenti')}): software recensiti`,
    `- [Glossario AI](${U('/glossario')}): definizioni dei termini`,
    `- [Metodologia editoriale](${U('/p/metodologia-editoriale')}): come verifichiamo le informazioni`, ''];
  for (const c of cats) {
    const items = C.listArticles({ categoryId: c.id, limit: 15 });
    if (!items.length) continue;
    out.push(`## ${c.name}`, '');
    for (const a of items) out.push(`- [${a.title}](${U(`/articoli/${a.slug}.md`)}): ${truncate(stripMd(a.tldr || a.excerpt), 200)}`);
    out.push('');
  }
  const ds = C.datasets.all();
  if (ds.length) {
    out.push('## Dataset', '');
    for (const d of ds) out.push(`- [${d.title}](${U(`/dati/${d.slug}`)}): ${d.insight || ''} (CSV: ${U(`/dati/${d.slug}.csv`)})`);
    out.push('');
  }
  out.push('## Optional', '', `- [Contenuto completo](${U('/llms-full.txt')})`, `- [Feed RSS](${U('/feed.xml')})`, '');
  res.type('text/plain; charset=utf-8').send(out.join('\n'));
});

router.get('/llms-full.txt', (req, res) => {
  const s = settings.all();
  const items = C.listArticles({ limit: 100 }).map((a) => C.hydrate(a)).filter((a) => !a.noindex);
  const out = [`# ${s.site_name} — contenuto completo`, '', `> ${s.site_description}`, ''];
  for (const a of items) out.push(articleMarkdown(a), '\n---\n');
  res.type('text/plain; charset=utf-8').send(out.join('\n'));
});

router.get('/feed.xml', (req, res) => {
  const s = settings.all();
  const items = C.listArticles({ limit: 30 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(s.site_name)}</title><link>${U('/')}</link><description>${esc(s.site_description)}</description>
<language>${esc(s.site_language)}</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${U('/feed.xml')}" rel="self" type="application/rss+xml"/>
${items.map((a) => `<item><title>${esc(a.title)}</title><link>${U(`/articoli/${a.slug}`)}</link><guid isPermaLink="true">${U(`/articoli/${a.slug}`)}</guid>
<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>${a.author_name ? `<dc:creator>${esc(a.author_name)}</dc:creator>` : ''}${a.category_name ? `<category>${esc(a.category_name)}</category>` : ''}
<description>${esc(a.tldr || a.excerpt || '')}</description>${a.cover_image ? `<media:content url="${esc(a.cover_image.startsWith('http') ? a.cover_image : U(a.cover_image))}" medium="image"/>` : ''}</item>`).join('\n')}
</channel></rss>`;
  res.type('application/rss+xml; charset=utf-8').send(xml);
});

router.get('/feed.json', (req, res) => {
  const s = settings.all();
  res.type('application/feed+json').send(JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1', title: s.site_name, home_page_url: U('/'), feed_url: U('/feed.json'), description: s.site_description, language: s.site_language,
    items: C.listArticles({ limit: 30 }).map((a) => ({
      id: U(`/articoli/${a.slug}`), url: U(`/articoli/${a.slug}`), title: a.title, summary: a.tldr || a.excerpt || '',
      date_published: a.published_at, date_modified: a.updated_at, tags: a.category_name ? [a.category_name] : [],
      authors: a.author_name ? [{ name: a.author_name, url: U(`/autore/${a.author_slug}`) }] : undefined,
    })),
  }, null, 2));
});

router.get('/manifest.webmanifest', (req, res) => {
  const s = settings.all();
  res.type('application/manifest+json').send(JSON.stringify({
    name: s.site_name, short_name: s.site_name, start_url: '/', display: 'standalone', background_color: '#0b1020', theme_color: '#4f46e5', lang: s.site_language,
    icons: [{ src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/img/logo-512.png', sizes: '512x512', type: 'image/png' }],
  }));
});

// File di verifica IndexNow (/<chiave>.txt)
router.get('/:key([a-f0-9]{32}).txt', (req, res, next) => {
  const key = settings.get('indexnow_key');
  if (!key || req.params.key !== key) return next();
  res.type('text/plain').send(key);
});

module.exports = router;
