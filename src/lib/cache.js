'use strict';
/** Micro-cache in memoria per HTML pubblico e rendering dei contenuti. Svuotata a ogni modifica dal pannello. */
const config = require('../config');

const pages = new Map();
const fragments = new Map();
const MAX = 2000;

function getPage(key) {
  const e = pages.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { pages.delete(key); return null; }
  return e;
}
function setPage(key, body, type) {
  if (!config.pageCacheTtl) return;
  if (pages.size > MAX) pages.delete(pages.keys().next().value);
  pages.set(key, { body, type, exp: Date.now() + config.pageCacheTtl * 1000 });
}
function fragment(key, fn) {
  if (fragments.has(key)) return fragments.get(key);
  const v = fn();
  if (fragments.size > MAX) fragments.delete(fragments.keys().next().value);
  fragments.set(key, v);
  return v;
}
function bust() { pages.clear(); fragments.clear(); }

module.exports = { getPage, setPage, fragment, bust };
