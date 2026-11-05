'use strict';
/** Accesso ai contenuti pubblicati + rendering del corpo articolo con monetizzazione. */
const db = require('../db');
const settings = require('./settings');
const cache = require('./cache');
const md = require('./markdown');
const charts = require('./charts');
const comp = require('./components');
const { parseJson, lines, stripMd, wordCount, readingTime, nowIso, today } = require('./utils');
const analyzer = require('../../public/js/seo-analyzer');

const PUB = "a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= ?";
const BASE = `SELECT a.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
  u.name AS author_name, u.slug AS author_slug
  FROM articles a LEFT JOIN categories c ON c.id = a.category_id LEFT JOIN users u ON u.id = a.author_id`;

function listArticles({ categoryId, tagId, authorId, type, featured, limit = 12, offset = 0, exclude = [], order = 'recent' } = {}) {
  const where = [PUB];
  const args = [nowIso()];
  if (categoryId) { where.push('a.category_id = ?'); args.push(categoryId); }
  if (authorId) { where.push('a.author_id = ?'); args.push(authorId); }
  if (type) { where.push('a.type = ?'); args.push(type); }
  if (featured) where.push('a.featured = 1');
  if (tagId) { where.push('a.id IN (SELECT article_id FROM article_tags WHERE tag_id = ?)'); args.push(tagId); }
  const ex = exclude.filter(Boolean).map(Number);
  if (ex.length) where.push(`a.id NOT IN (${ex.join(',')})`);
  const ord = order === 'popular' ? 'a.views DESC, a.published_at DESC'
    : order === 'trending' ? "(a.views + 20) / (julianday('now') - julianday(a.published_at) + 2) DESC"
      : 'a.published_at DESC';
  return db.all(`${BASE} WHERE ${where.join(' AND ')} ORDER BY ${ord} LIMIT ? OFFSET ?`, ...args, limit, offset);
}
function countArticles({ categoryId, tagId, authorId } = {}) {
  const where = [PUB];
  const args = [nowIso()];
  if (categoryId) { where.push('a.category_id = ?'); args.push(categoryId); }
  if (authorId) { where.push('a.author_id = ?'); args.push(authorId); }
  if (tagId) { where.push('a.id IN (SELECT article_id FROM article_tags WHERE tag_id = ?)'); args.push(tagId); }
  return db.get(`SELECT COUNT(*) n FROM articles a WHERE ${where.join(' AND ')}`, ...args).n;
}

function getArticle(slug, { preview = false } = {}) {
  const a = preview
    ? db.get(`${BASE} WHERE a.slug = ?`, slug)
    : db.get(`${BASE} WHERE a.slug = ? AND ${PUB}`, slug, nowIso());
  return a ? hydrate(a) : null;
}
function hydrate(a) {
  a.author = a.author_id ? db.get('SELECT id, name, slug, job_title, bio, expertise, avatar, same_as FROM users WHERE id = ?', a.author_id) : null;
  a.tags = db.all('SELECT t.* FROM tags t JOIN article_tags at ON at.tag_id = t.id WHERE at.article_id = ? ORDER BY t.name', a.id);
  a.tools = db.all("SELECT t.* FROM tools t JOIN article_tools x ON x.tool_id = t.id WHERE x.article_id = ? AND t.status = 'published' ORDER BY x.sort", a.id);
  a.faqList = parseJson(a.faq, []).filter((f) => f.q && f.a);
  a.stepList = parseJson(a.steps, []).filter((s) => s.name && s.text);
  a.sourceList = parseJson(a.sources, []).filter((s) => s.url);
  a.takeawayList = lines(a.takeaways);
  return a;
}
function related(a, limit = 4) {
  const tagIds = a.tags.map((t) => t.id);
  const rows = db.all(`${BASE} WHERE ${PUB} AND a.id != ? AND (a.category_id = ? ${tagIds.length ? `OR a.id IN (SELECT article_id FROM article_tags WHERE tag_id IN (${tagIds.join(',')}))` : ''})
    ORDER BY (CASE WHEN a.id IN (SELECT article_id FROM article_tags WHERE tag_id IN (${tagIds.join(',') || 0})) THEN 0 ELSE 1 END), a.published_at DESC LIMIT ?`,
  nowIso(), a.id, a.category_id || 0, limit);
  return rows;
}
function incrementViews(table, id) {
  db.run(`UPDATE ${table === 'datasets' ? 'datasets' : 'articles'} SET views = views + 1 WHERE id = ?`, id);
  trackDaily('view');
}
function trackDaily(kind) {
  db.run('INSERT INTO daily_stats(day, kind, count) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1', today(), kind);
}

// ---------- Ricerca full-text
function ftsQuery(q) {
  const terms = String(q || '').normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  return terms.slice(0, 8).map((t) => `"${t.replace(/"/g, '')}"*`).join(' ');
}
function search(q, limit = 30) {
  const fq = ftsQuery(q);
  if (!fq) return [];
  try {
    return db.all(`${BASE} JOIN articles_fts f ON f.rowid = a.id WHERE articles_fts MATCH ? AND ${PUB}
      ORDER BY bm25(articles_fts, 10.0, 4.0, 4.0, 1.0) LIMIT ?`, fq, nowIso(), limit);
  } catch { return []; }
}
function syncFts(a) {
  db.run('DELETE FROM articles_fts WHERE rowid = ?', a.id);
  db.run('INSERT INTO articles_fts(rowid, title, excerpt, tldr, content) VALUES (?, ?, ?, ?, ?)', a.id, a.title, a.excerpt || '', a.tldr || '', stripMd(a.content_md));
}

// ---------- Altri contenuti
const tools = {
  all: () => db.all("SELECT * FROM tools WHERE status = 'published' ORDER BY featured DESC, rating DESC, name"),
  bySlug: (slug) => db.get("SELECT * FROM tools WHERE slug = ? AND status = 'published'", slug),
  categories: () => db.all("SELECT category, COUNT(*) n FROM tools WHERE status = 'published' AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY n DESC"),
};
const models = {
  all: () => db.all("SELECT * FROM ai_models WHERE status = 'published' ORDER BY (score_reasoning + score_coding + score_speed + score_value) DESC, name"),
  bySlug: (slug) => db.get("SELECT * FROM ai_models WHERE slug = ? AND status = 'published'", slug),
};
const datasets = {
  all: () => db.all("SELECT d.*, c.name category_name FROM datasets d LEFT JOIN categories c ON c.id = d.category_id WHERE d.status = 'published' ORDER BY d.published_at DESC"),
  bySlug: (slug) => db.get("SELECT * FROM datasets WHERE slug = ? AND status = 'published'", slug),
};

function chartSvg(ds, opts = {}) {
  return cache.fragment(`chart:${ds.id}:${ds.updated_at}:${opts.standalone ? 1 : 0}`, () => charts.renderChart(ds, { siteName: settings.get('site_name'), ...opts }));
}

// ---------- Rendering corpo articolo
function renderBody(a) {
  return cache.fragment(`body:${a.id}:${a.updated_at}`, () => {
    const s = settings.all();
    const autoMax = s.auto_affiliate_links === '1' ? Number(s.auto_affiliate_max) || 0 : 0;
    return md.render(a.content_md, {
      tools: autoMax ? db.all("SELECT slug, name, keywords FROM tools WHERE status = 'published' AND keywords IS NOT NULL AND keywords != ''") : [],
      autoAffiliateMax: autoMax,
      renderTool: (slug) => comp.toolBox(tools.bySlug(slug)),
      renderModel: (slug) => comp.modelCard(models.bySlug(slug)),
      renderChart: (slug) => { const ds = datasets.bySlug(slug); return ds ? comp.chartEmbed(ds, chartSvg(ds)) : ''; },
      adHtml: comp.adSlot('article'),
      adAfter: Number(s.ad_in_article_after) || 0,
      newsletterHtml: comp.newsletterBox('article'),
    });
  });
}

/** Calcola metriche e punteggi SEO/AEO/GEO di un articolo (usato al salvataggio). */
function scoreArticle(a, author) {
  const r = analyzer.analyze({
    title: a.title, metaTitle: a.meta_title, metaDescription: a.meta_description, excerpt: a.excerpt,
    slug: a.slug, focusKeyword: a.focus_keyword, content: a.content_md, tldr: a.tldr, type: a.type,
    faqCount: parseJson(a.faq, []).filter((f) => f.q && f.a).length,
    takeawaysCount: lines(a.takeaways).length,
    sourcesCount: parseJson(a.sources, []).filter((s) => s.url).length,
    hasAuthor: !!(author && author.bio),
    coverImage: a.cover_image, coverAlt: a.cover_alt,
  });
  const wc = wordCount(stripMd(a.content_md));
  return { ...r, wordCount: wc, readingTime: readingTime(wc) };
}

module.exports = {
  PUB, BASE, listArticles, countArticles, getArticle, hydrate, related, incrementViews, trackDaily,
  search, syncFts, tools, models, datasets, chartSvg, renderBody, scoreArticle,
};
