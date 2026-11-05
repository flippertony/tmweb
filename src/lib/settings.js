'use strict';
const crypto = require('node:crypto');
const db = require('../db');

// Impostazioni modificabili dal pannello (sezione "Impostazioni")
const DEFAULTS = {
  site_name: 'TrendMind',
  site_tagline: 'AI, tecnologia e nuove opportunità di guadagno — spiegate con i dati',
  site_description: 'News sull\'intelligenza artificiale, confronto tra modelli AI, infografiche con dati ufficiali, trend social e strumenti per lavorare e guadagnare online.',
  site_language: 'it-IT',
  default_og_image: '/img/og-default.png',
  organization_name: 'TrendMind',
  contact_email: 'redazione@example.com',
  social_profiles: '', // uno per riga (sameAs)
  twitter_handle: '',
  // Monetizzazione
  affiliate_disclosure: 'Alcuni link in questa pagina sono link di affiliazione: se acquisti tramite essi potremmo ricevere una commissione, senza costi aggiuntivi per te. Le nostre valutazioni restano indipendenti.',
  auto_affiliate_links: '1',
  auto_affiliate_max: '3',
  adsense_client: '', // ca-pub-XXXXXXXX
  ad_slot_header: '',
  ad_slot_article: '',
  ad_slot_sidebar: '',
  ad_in_article_after: '3', // annuncio dopo il paragrafo N (0 = mai)
  affiliate_conversion_rate: '2.5', // % stimata per il calcolo dei ricavi
  // Analytics e codice personalizzato
  plausible_domain: '',
  ga4_id: '',
  head_code: '',
  body_end_code: '',
  // SEO / GEO / AEO
  allow_ai_crawlers: '1',
  allow_ai_training: '0',
  indexnow_key: '',
  indexnow_enabled: '0',
  google_site_verification: '',
  bing_site_verification: '',
  llms_intro: 'TrendMind è una testata indipendente in lingua italiana su intelligenza artificiale, modelli AI, dati statistici e opportunità di guadagno digitali. Ogni articolo include una risposta rapida, fonti verificabili e data di aggiornamento.',
  // Newsletter
  newsletter_title: 'Il Radar AI della settimana',
  newsletter_text: 'Ogni lunedì: le 5 novità AI che contano, un dato da sapere e uno strumento per guadagnare tempo (o soldi). Gratis, cancellazione in un clic.',
};

let cache = null;
function load() {
  const rows = db.all('SELECT key, value FROM settings');
  cache = { ...DEFAULTS };
  for (const r of rows) cache[r.key] = r.value ?? '';
  return cache;
}
function all() { return cache || load(); }
function get(key) { return all()[key]; }
function set(obj) {
  db.tx(() => {
    for (const [k, v] of Object.entries(obj)) {
      if (!(k in DEFAULTS)) continue;
      db.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v ?? ''));
    }
  });
  cache = null;
}
function ensureIndexNowKey() {
  if (!get('indexnow_key')) set({ indexnow_key: crypto.randomBytes(16).toString('hex') });
}
module.exports = { DEFAULTS, all, get, set, reload: load, ensureIndexNowKey };
