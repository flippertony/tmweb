'use strict';
// Test end-to-end su database temporaneo: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.SITE_URL = 'http://test.local';
process.env.PAGE_CACHE_TTL = '0';

const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'src', 'db', 'seed.js')], { env: process.env });

const app = require('../src/server');
const analyzer = require('../public/js/seo-analyzer');
const charts = require('../src/lib/charts');
const md = require('../src/lib/markdown');
const { slugify } = require('../src/lib/utils');

let server, base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const get = (p, opts = {}) => fetch(base + p, { redirect: 'manual', ...opts });

test('slugify gestisce accenti e simboli', () => {
  assert.strictEqual(slugify('Cos\'è l\'AI? Perché & come'), 'cos-e-l-ai-perche-e-come');
});

test('analizzatore: punteggi coerenti', () => {
  const r = analyzer.analyze({ title: 'GEO: guida completa per farsi citare dalle AI', focusKeyword: 'GEO', slug: 'geo-guida', content: '## Cos\'è il GEO?\n\nIl GEO è…', tldr: 'Il GEO è una tecnica.', faqCount: 3, sourcesCount: 2, takeawaysCount: 3, hasAuthor: true });
  for (const k of ['seo', 'aeo', 'geo']) assert.ok(r[k] >= 0 && r[k] <= 100);
  assert.ok(r.checks.find((c) => c.label.startsWith('Keyword nel titolo')).ok);
});

test('analizzatore: keyword con apostrofo e stopword nello slug', () => {
  const r = analyzer.analyze({ title: 'Guadagnare con l\'intelligenza artificiale', focusKeyword: 'guadagnare con l\'intelligenza artificiale', slug: 'guadagnare-intelligenza-artificiale', content: '' });
  assert.ok(r.checks.find((c) => c.label.startsWith('Keyword nello slug')).ok);
});

test('grafici: CSV multi-serie e SVG accessibile', () => {
  const d = charts.parseCsv('Anno,A,B\n2023,1,2\n2024,3,4');
  assert.deepStrictEqual(d.labels, ['2023', '2024']);
  assert.strictEqual(d.series.length, 2);
  for (const type of ['bar', 'hbar', 'line', 'donut']) {
    const svg = charts.renderChart({ title: 'T', slug: 't', chart_type: type, data_csv: 'X,Y\na,1\nb,2' });
    assert.match(svg, /^<svg[^>]+role="img"/);
    assert.match(svg, /<title id=/);
  }
});

test('markdown: shortcode, TOC e auto-link affiliato', () => {
  const r = md.render('## Uno\n\nUsa Notion ogni giorno.\n\n[[tool:notion]]', {
    tools: [{ slug: 'notion', name: 'Notion', keywords: 'Notion' }], autoAffiliateMax: 2, renderTool: (s) => `<aside data-t="${s}"></aside>`,
  });
  assert.strictEqual(r.toc[0].id, 'uno');
  assert.match(r.html, /href="\/go\/notion" rel="sponsored nofollow"/);
  assert.match(r.html, /<aside data-t="notion">/);
});

test('pagine pubbliche principali rispondono 200', async () => {
  for (const p of ['/', '/articoli', '/modelli-ai', '/modelli-ai/calcolatore-costi', '/modelli-ai/confronto', '/strumenti', '/dati', '/glossario', '/cerca?q=ai', '/p/chi-siamo', '/categoria/ai-news', '/autore/redazione']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p);
  }
});

test('articolo: JSON-LD valido con FAQPage e Markdown alternativo', async () => {
  const html = await (await get('/articoli/geo-come-farsi-citare-da-chatgpt-perplexity-gemini')).text();
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const types = json['@graph'].flatMap((n) => [].concat(n['@type']));
  for (const t of ['Organization', 'WebSite', 'Article', 'FAQPage', 'BreadcrumbList']) assert.ok(types.includes(t), t);
  assert.match(html, /<link rel="canonical" href="http:\/\/test\.local\/articoli\/geo-/);
  const mdRes = await get('/articoli/geo-come-farsi-citare-da-chatgpt-perplexity-gemini.md');
  assert.match(mdRes.headers.get('content-type'), /markdown/);
});

test('file SEO/GEO tecnici', async () => {
  assert.match(await (await get('/robots.txt')).text(), /Sitemap: http:\/\/test\.local\/sitemap\.xml/);
  assert.match(await (await get('/sitemap.xml')).text(), /<urlset/);
  assert.match(await (await get('/sitemap-news.xml')).text(), /news:news/);
  assert.match(await (await get('/llms.txt')).text(), /^# /);
  assert.match(await (await get('/feed.xml')).text(), /<rss/);
  JSON.parse(await (await get('/feed.json')).text());
  assert.match((await get('/dati/imprese-ai-italia-ue.svg')).headers.get('content-type'), /svg/);
});

test('redirect affiliato tracciato e 404', async () => {
  const r = await get('/go/notion', { headers: { 'user-agent': 'Mozilla/5.0' } });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), 'https://www.notion.so');
  assert.strictEqual((await get('/non-esiste')).status, 404);
  assert.strictEqual((await get('/articoli/')).status, 301);
});

test('newsletter: validazione e iscrizione', async () => {
  const post = (body) => get('/newsletter', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  assert.strictEqual((await post('email=nonvalida')).status, 400);
  const ok = await (await post('email=test%40esempio.it&source=test')).json();
  assert.strictEqual(ok.ok, true);
});

test('pannello: protetto e con CSRF', async () => {
  const r = await get('/admin');
  assert.strictEqual(r.status, 302);
  assert.match(r.headers.get('location'), /\/admin\/(setup|login)/);
  const setup = await get('/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Test&email=a%40b.it&password=passwordlunga123' });
  assert.strictEqual(setup.status, 302);
  const cookie = setup.headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await get('/admin', { headers: { cookie } })).status, 200);
  const noCsrf = await get('/admin/impostazioni', { method: 'POST', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'site_name=x' });
  assert.strictEqual(noCsrf.status, 403);
});

test('markdown: sanitizzazione XSS', () => {
  const html = md.renderPlain('<script>alert(1)</script><img src=x onerror=alert(1)> <a href="javascript:alert(2)">y</a>');
  assert.doesNotMatch(html, /<script|onerror|javascript:/i);
});
