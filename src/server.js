'use strict';
const path = require('node:path');
const express = require('express');
const compression = require('compression');
const config = require('./config');
const db = require('./db');
const settings = require('./lib/settings');
const cache = require('./lib/cache');
const auth = require('./lib/auth');
const comp = require('./lib/components');
const utils = require('./lib/utils');
const seo = require('./lib/seo');
const publicRoutes = require('./routes/public');
const seoRoutes = require('./routes/seo');
const adminRoutes = require('./routes/admin');

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(config.root, 'views'));
if (config.isProd) app.set('view cache', true);

app.use(compression());

// Header di sicurezza
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  });
  if (config.isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Statici con cache lunga (asset versionati con ?v=)
const ASSET_VERSION = Date.now().toString(36);
app.use(express.static(path.join(config.root, 'public'), { maxAge: config.isProd ? '30d' : 0, index: false }));
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '365d', immutable: true, index: false }));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

// Normalizzazione URL: niente slash finale (evita contenuti duplicati)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.length > 1 && req.path.endsWith('/')) {
    const q = req.url.slice(req.path.length);
    return res.redirect(301, req.path.replace(/\/+$/, '') + q);
  }
  next();
});

// Redirect 301 gestiti dal CMS
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/admin')) return next();
  const r = db.get('SELECT id, to_path FROM redirects WHERE from_path = ?', req.path);
  if (!r) return next();
  db.run('UPDATE redirects SET hits = hits + 1 WHERE id = ?', r.id);
  res.redirect(301, r.to_path);
});

// Variabili disponibili in tutti i template
app.use((req, res, next) => {
  const s = settings.all();
  res.locals.s = s;
  res.locals.h = utils;
  res.locals.comp = comp;
  res.locals.siteUrl = config.siteUrl;
  res.locals.assetV = ASSET_VERSION;
  res.locals.currentPath = req.path;
  res.locals.abs = seo.abs;
  if (!req.path.startsWith('/admin')) {
    res.locals.navCats = cache.fragment('nav', () => db.all('SELECT name, slug FROM categories ORDER BY sort, name LIMIT 8'));
    res.locals.footerPages = cache.fragment('footer', () => db.all('SELECT title, slug FROM pages WHERE in_footer = 1 ORDER BY title'));
  }
  next();
});

// Anteprima bozze per redattori loggati
app.use((req, res, next) => {
  if (req.query.anteprima !== '1') return next();
  auth.loadUser(req, res, () => { req.isEditor = !!req.user; next(); });
});

// Micro-cache HTML per le pagine pubbliche
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/admin') || req.path.startsWith('/go/') || req.query.anteprima || req.path === '/cerca') return next();
  const key = req.originalUrl;
  const hit = cache.getPage(key);
  // il contatore viste degli articoli viene incrementato anche con la cache attiva
  const m = req.path.match(/^\/articoli\/([^/.]+)$/);
  if (hit) {
    if (m) db.run("UPDATE articles SET views = views + 1 WHERE slug = ? AND status = 'published'", m[1]);
    if (m) db.run("INSERT INTO daily_stats(day, kind, count) VALUES (?, 'view', 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1", utils.today());
    res.set('X-Cache', 'HIT').type(hit.type);
    return res.send(hit.body);
  }
  const send = res.send.bind(res);
  res.send = (body) => {
    if (res.statusCode === 200 && typeof body === 'string') cache.setPage(key, body, res.get('Content-Type') || 'text/html');
    res.set('X-Cache', 'MISS');
    return send(body);
  };
  next();
});

app.use('/admin', adminRoutes);
app.use('/', seoRoutes);
app.use('/', publicRoutes.router);

app.use((req, res) => publicRoutes.notFound(res));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (res.headersSent) return;
  res.status(500).send(config.isProd ? 'Errore interno del server' : `<pre>${utils.esc(err.stack)}</pre>`);
});

if (require.main === module) {
  settings.ensureIndexNowKey();
  auth.cleanupSessions();
  setInterval(() => auth.cleanupSessions(), 6 * 3600e3).unref();
  const needsSetup = db.get("SELECT COUNT(*) n FROM users WHERE role = 'admin'").n === 0;
  app.listen(config.port, () => {
    console.log(`\n  ${settings.get('site_name')} attivo su ${config.siteUrl} (porta ${config.port})`);
    console.log(`  Pannello CMS: ${config.siteUrl}/admin${needsSetup ? '/setup  ← crea il primo amministratore' : ''}\n`);
  });
}

module.exports = app;
