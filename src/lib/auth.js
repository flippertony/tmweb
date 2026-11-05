'use strict';
const crypto = require('node:crypto');
const db = require('../db');
const config = require('../config');

const COOKIE = 'tm_sid';
const SESSION_DAYS = 14;
const SCRYPT = { N: 16384, r: 8, p: 1 };

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64, SCRYPT);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

const sign = (v) => v + '.' + crypto.createHmac('sha256', config.sessionSecret).update(v).digest('base64url');
function unsign(signed) {
  const i = String(signed || '').lastIndexOf('.');
  if (i < 1) return null;
  const v = signed.slice(0, i);
  const a = Buffer.from(sign(v)), b = Buffer.from(signed);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? v : null;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie malformato */ }
    }
  }
  return out;
}

function createSession(res, userId) {
  const id = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.run('INSERT INTO sessions(id, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)', id, userId, csrf, expires.toISOString());
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(id))}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${config.isProd ? '; Secure' : ''}`);
}
function destroySession(req, res) {
  if (req.sessionId) db.run('DELETE FROM sessions WHERE id = ?', req.sessionId);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Carica l'utente dal cookie di sessione (usato su /admin)
function loadUser(req, res, next) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  const sid = raw && unsign(raw);
  if (sid) {
    const row = db.get('SELECT s.id sid, s.csrf, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', sid);
    if (row && row.expires_at > new Date().toISOString()) {
      req.sessionId = row.sid;
      req.csrf = row.csrf;
      delete row.password_hash;
      req.user = row;
    }
  }
  res.locals.user = req.user || null;
  res.locals.csrf = req.csrf || '';
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}
function requireRole(...roles) {
  return (req, res, next) => (roles.includes(req.user?.role)
    ? next()
    : res.status(403).render('admin/error', { title: 'Accesso negato', message: 'Il tuo ruolo non consente questa operazione.' }));
}
function verifyCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  const token = req.body?._csrf || req.headers['x-csrf-token'];
  if (!req.csrf || !token || token !== req.csrf) return res.status(403).send('Token CSRF non valido. Ricarica la pagina e riprova.');
  next();
}

// Rate-limit in memoria (login, newsletter)
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n++;
  buckets.set(key, b);
  if (buckets.size > 10000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  return b.n <= max;
}

function cleanupSessions() { db.run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString()); }

module.exports = { hashPassword, verifyPassword, createSession, destroySession, loadUser, requireAuth, requireRole, verifyCsrf, rateLimit, cleanupSessions, parseCookies };
