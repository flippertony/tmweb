'use strict';

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

function stripMd(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const wordCount = (text) => (String(text || '').match(/[\p{L}\p{N}]+/gu) || []).length;
const readingTime = (words) => Math.max(1, Math.round(words / 220));
const truncate = (s, n) => { s = String(s || ''); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function fmtDate(iso, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  let s = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (withTime) s += `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}
// Per input <input type="datetime-local"> (ora locale del server, TZ redazione)
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function parseJson(s, fallback) {
  if (!s) return fallback;
  try { const v = JSON.parse(s); return v ?? fallback; } catch { return fallback; }
}
const lines = (s) => String(s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const toArr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function fmtNumber(n, digits = 0) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { maximumFractionDigits: digits });
}
function compact(n) {
  n = Number(n);
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' Mld';
  if (a >= 1e6) return (n / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' Mln';
  if (a >= 1e4) return (n / 1e3).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'K';
  return n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^(https?:)?\/\//i.test(u) || u.startsWith('/') || u.startsWith('mailto:')) return u;
  return '';
}

module.exports = {
  esc, slugify, stripMd, wordCount, readingTime, truncate, fmtDate, toLocalInput, fromLocalInput,
  nowIso, today, parseJson, lines, toArr, fmtNumber, compact, safeUrl,
};
