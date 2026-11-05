'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Caricamento minimale di .env (nessuna dipendenza esterna)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.env.TZ = process.env.TZ || 'Europe/Rome';

const root = path.join(__dirname, '..');
const config = {
  root,
  port: Number(process.env.PORT || 3000),
  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  isProd: process.env.NODE_ENV === 'production',
  dbPath: path.resolve(root, process.env.DB_PATH || './data/trendmind.db'),
  uploadsDir: path.join(root, 'data', 'uploads'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me-dev-secret-change-me',
  pageCacheTtl: Number(process.env.PAGE_CACHE_TTL ?? 60),
  trustProxy: process.env.TRUST_PROXY === '1',
};

if (config.isProd && config.sessionSecret.startsWith('dev-secret')) {
  console.warn('[ATTENZIONE] SESSION_SECRET non impostato: configuralo in produzione.');
}
module.exports = config;
