'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const sqlite = new DatabaseSync(config.dbPath);
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
sqlite.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) { s = sqlite.prepare(sql); cache.set(sql, s); }
  return s;
}
// node:sqlite non accetta undefined/boolean: normalizziamo i parametri
function norm(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
function params(args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const o = {};
    for (const [k, v] of Object.entries(args[0])) o[k] = norm(v);
    return [o];
  }
  return args.flat().map(norm);
}
// Converte righe con prototype null in oggetti normali (comodo per EJS/JSON)
const plain = (r) => (r ? { ...r } : r);

const db = {
  raw: sqlite,
  all: (sql, ...a) => stmt(sql).all(...params(a)).map(plain),
  get: (sql, ...a) => plain(stmt(sql).get(...params(a))),
  run: (sql, ...a) => stmt(sql).run(...params(a)),
  exec: (sql) => sqlite.exec(sql),
  tx(fn) {
    sqlite.exec('BEGIN');
    try { const r = fn(); sqlite.exec('COMMIT'); return r; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
module.exports = db;
