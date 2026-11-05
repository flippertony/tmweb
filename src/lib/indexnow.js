'use strict';
/** Notifica istantanea a Bing, Yandex, Seznam, Naver (protocollo IndexNow) quando un contenuto viene pubblicato o aggiornato. */
const settings = require('./settings');
const config = require('../config');

async function ping(paths) {
  const s = settings.all();
  if (s.indexnow_enabled !== '1' || !s.indexnow_key || !paths.length) return { skipped: true };
  if (/localhost|127\.0\.0\.1/.test(config.siteUrl)) return { skipped: true, reason: 'localhost' };
  const host = new URL(config.siteUrl).host;
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: s.indexnow_key, keyLocation: `${config.siteUrl}/${s.indexnow_key}.txt`, urlList: paths.map((p) => config.siteUrl + p) }),
      signal: AbortSignal.timeout(8000),
    });
    return { status: r.status };
  } catch (e) {
    console.warn('[IndexNow]', e.message);
    return { error: e.message };
  }
}
module.exports = { ping };
