-- TrendMind — schema database (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor', -- admin | editor | author
  job_title     TEXT,
  bio           TEXT,
  expertise     TEXT,          -- competenze separate da virgola (E-E-A-T)
  avatar        TEXT,
  same_as       TEXT,          -- profili social/professionali, uno per riga
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  color            TEXT DEFAULT '#4f46e5',
  sort             INTEGER DEFAULT 0,
  meta_title       TEXT,
  meta_description TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL DEFAULT 'news', -- news | guide | analysis | review | list
  excerpt          TEXT,
  tldr             TEXT,       -- risposta rapida (AEO / featured snippet)
  takeaways        TEXT,       -- punti chiave, uno per riga
  content_md       TEXT,
  faq              TEXT,       -- JSON [{q,a}]
  steps            TEXT,       -- JSON [{name,text}] per HowTo
  sources          TEXT,       -- JSON [{title,url,publisher}] (GEO: citazioni)
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  author_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cover_image      TEXT,
  cover_alt        TEXT,
  status           TEXT NOT NULL DEFAULT 'draft', -- draft | published
  featured         INTEGER NOT NULL DEFAULT 0,
  sponsored        INTEGER NOT NULL DEFAULT 0,
  focus_keyword    TEXT,
  meta_title       TEXT,
  meta_description TEXT,
  canonical_url    TEXT,
  noindex          INTEGER NOT NULL DEFAULT 0,
  word_count       INTEGER DEFAULT 0,
  reading_time     INTEGER DEFAULT 1,
  seo_score        INTEGER DEFAULT 0,
  aeo_score        INTEGER DEFAULT 0,
  geo_score        INTEGER DEFAULT 0,
  views            INTEGER NOT NULL DEFAULT 0,
  published_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(status, published_at);
CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category_id);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, excerpt, tldr, content, tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- Strumenti / prodotti con link di affiliazione
CREATE TABLE IF NOT EXISTS tools (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  category       TEXT,          -- es. "Scrittura AI", "Hosting", "Corsi"
  tagline        TEXT,
  description_md TEXT,
  logo           TEXT,
  website        TEXT,
  affiliate_url  TEXT,
  network        TEXT,          -- Amazon, Impact, PartnerStack, diretto...
  commission     REAL DEFAULT 0, -- commissione media stimata in € per conversione
  pricing        TEXT,
  free_plan      INTEGER DEFAULT 0,
  rating         REAL DEFAULT 0,
  pros           TEXT,          -- uno per riga
  cons           TEXT,          -- uno per riga
  coupon         TEXT,
  keywords       TEXT,          -- parole per auto-link affiliato, separate da virgola
  featured       INTEGER DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'published',
  clicks         INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  source     TEXT,              -- pagina di provenienza
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clicks_date ON clicks(created_at);

CREATE TABLE IF NOT EXISTS article_tools (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tool_id    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  sort       INTEGER DEFAULT 0,
  PRIMARY KEY (article_id, tool_id)
);

-- Directory modelli AI
CREATE TABLE IF NOT EXISTS ai_models (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  provider        TEXT,
  model_type      TEXT,          -- LLM, immagini, video, audio, multimodale
  release_date    TEXT,
  context_window  INTEGER,       -- token
  input_price     REAL,          -- $ per 1M token input
  output_price    REAL,          -- $ per 1M token output
  open_weights    INTEGER DEFAULT 0,
  modalities      TEXT,          -- testo, immagini, audio...
  description     TEXT,
  strengths       TEXT,          -- uno per riga
  weaknesses      TEXT,          -- uno per riga
  best_for        TEXT,
  website         TEXT,
  tool_id         INTEGER REFERENCES tools(id) ON DELETE SET NULL,
  score_reasoning INTEGER DEFAULT 0, -- valutazioni editoriali 0-100
  score_coding    INTEGER DEFAULT 0,
  score_speed     INTEGER DEFAULT 0,
  score_value     INTEGER DEFAULT 0,
  verified        INTEGER DEFAULT 0, -- 1 = dati verificati dalla redazione
  checked_at      TEXT,
  status          TEXT NOT NULL DEFAULT 'published',
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Dataset statistici e infografiche
CREATE TABLE IF NOT EXISTS datasets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  insight        TEXT,           -- dato chiave in una frase (AEO)
  description_md TEXT,
  chart_type     TEXT NOT NULL DEFAULT 'bar', -- bar | hbar | line | donut
  unit           TEXT,
  data_csv       TEXT,
  source_name    TEXT,
  source_url     TEXT,
  license        TEXT,
  period         TEXT,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  verified       INTEGER DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'published',
  views          INTEGER NOT NULL DEFAULT 0,
  published_at   TEXT,
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS glossary (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  term       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  short_def  TEXT,
  content_md TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  content_md       TEXT,
  meta_description TEXT,
  in_footer        INTEGER DEFAULT 1,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  source     TEXT,
  consent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT NOT NULL,
  original   TEXT,
  mime       TEXT,
  size       INTEGER,
  alt        TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Redirect 301 (creati automaticamente al cambio slug)
CREATE TABLE IF NOT EXISTS redirects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_path  TEXT NOT NULL UNIQUE,
  to_path    TEXT NOT NULL,
  hits       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Statistiche giornaliere aggregate (nessun dato personale)
CREATE TABLE IF NOT EXISTS daily_stats (
  day    TEXT NOT NULL,
  kind   TEXT NOT NULL, -- view | click | subscribe
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
