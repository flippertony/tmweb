'use strict';
/**
 * Rendering Markdown → HTML con estensioni editoriali e di monetizzazione:
 *  - ID automatici sui titoli + indice (TOC)
 *  - shortcode: [[tool:slug]] [[chart:slug]] [[model:slug]] [[ad]] [[newsletter]] [[callout:testo]]
 *  - auto-link affiliati sulle parole chiave degli strumenti (rel="sponsored nofollow")
 *  - annuncio automatico dopo il paragrafo N
 *  - link esterni con rel="noopener"
 */
const { Marked, Renderer } = require('marked');
const { esc, slugify } = require('./utils');

function createRenderer(toc) {
  const used = new Set();
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text.replace(/<[^>]+>/g, ''));
        let k = 2;
        while (used.has(id)) id = `${slugify(text)}-${k++}`;
        used.add(id);
        if (depth === 2 || depth === 3) toc.push({ id, text: inner.replace(/<[^>]+>/g, ''), depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href || '');
        const t = title ? ` title="${esc(title)}"` : '';
        if (/^javascript:/i.test(href || '')) return text;
        return `<a href="${esc(href)}"${t}${external ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
      },
      image({ href, title, text }) {
        const t = title ? `<figcaption>${esc(title)}</figcaption>` : '';
        return `<figure><img src="${esc(href)}" alt="${esc(text)}" loading="lazy" decoding="async">${t}</figure>`;
      },
      table(token) {
        // tabella responsive
        const html = Renderer.prototype.table.call(this, token);
        return `<div class="table-wrap">${html}</div>`;
      },
    },
  });
  return marked;
}

/**
 * Inserisce link affiliati sulla prima occorrenza delle keyword degli strumenti,
 * solo dentro i <p> e mai all'interno di link, titoli o codice.
 */
function autoAffiliate(html, tools, max) {
  if (!tools?.length || max <= 0) return html;
  const entries = [];
  for (const t of tools) {
    for (const kw of String(t.keywords || '').split(',').map((s) => s.trim()).filter((s) => s.length > 2)) {
      entries.push({ kw, slug: t.slug, name: t.name });
    }
  }
  if (!entries.length) return html;
  entries.sort((a, b) => b.kw.length - a.kw.length);
  const done = new Set();
  let count = 0;
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (full, inner) => {
    if (count >= max) return full;
    // divide in segmenti testo/tag e salta il contenuto di <a> e <code>
    const parts = inner.split(/(<[^>]+>)/);
    let depth = 0;
    for (let i = 0; i < parts.length && count < max; i++) {
      const p = parts[i];
      if (p.startsWith('<')) {
        if (/^<(a|code)\b/i.test(p)) depth++;
        else if (/^<\/(a|code)>/i.test(p)) depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth > 0 || !p.trim()) continue;
      for (const e of entries) {
        if (done.has(e.slug) || count >= max) continue;
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${e.kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\p{L}\\p{N}]|$)`, 'iu');
        if (re.test(parts[i])) {
          parts[i] = parts[i].replace(re, (m, pre, word) => `${pre}<a href="/go/${e.slug}" rel="sponsored nofollow" class="aff-link" data-aff="${e.slug}">${word}</a>`);
          done.add(e.slug);
          count++;
          break;
        }
      }
    }
    return `<p>${parts.join('')}</p>`;
  });
}

// Difesa in profondità: rimuove script, iframe non consentiti, handler on* e URL javascript:
function sanitize(html) {
  return html
    .replace(/<\s*(script|style|object|embed|form|meta|link|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*iframe\b(?![^>]*\bsrc\s*=\s*["']https:\/\/(www\.youtube(-nocookie)?\.com|player\.vimeo\.com)\/)[^>]*>([\s\S]*?<\s*\/\s*iframe\s*>)?/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, '$1="#"');
}

function injectAd(html, afterN, adHtml) {
  if (!afterN || !adHtml) return html;
  let i = 0;
  let injected = false;
  const out = html.replace(/<\/p>/g, (m) => {
    i++;
    if (!injected && i === afterN) { injected = true; return m + adHtml; }
    return m;
  });
  return out;
}

/**
 * @param {string} md
 * @param {object} ctx { tools, renderTool(slug), renderChart(slug), renderModel(slug), adHtml, newsletterHtml, autoAffiliateMax, adAfter }
 */
function render(md, ctx = {}) {
  const toc = [];
  const marked = createRenderer(toc);
  let html = sanitize(marked.parse(String(md || '')));

  // shortcode su riga propria → blocco
  html = html.replace(/<p>\s*\[\[([a-z]+)(?::([^\]]+))?\]\]\s*<\/p>/g, (m, kind, arg) => block(kind, (arg || '').trim(), ctx) ?? m);
  // shortcode inline residui
  html = html.replace(/\[\[([a-z]+)(?::([^\]]+))?\]\]/g, (m, kind, arg) => block(kind, (arg || '').trim(), ctx) ?? '');

  if (ctx.autoAffiliateMax) html = autoAffiliate(html, ctx.tools, ctx.autoAffiliateMax);
  if (ctx.adAfter && ctx.adHtml && !/\[\[ad\]\]/.test(md)) html = injectAd(html, ctx.adAfter, ctx.adHtml);
  return { html, toc };
}

function block(kind, arg, ctx) {
  switch (kind) {
    case 'tool': return ctx.renderTool ? ctx.renderTool(arg) : '';
    case 'chart': return ctx.renderChart ? ctx.renderChart(arg) : '';
    case 'model': return ctx.renderModel ? ctx.renderModel(arg) : '';
    case 'ad': return ctx.adHtml || '';
    case 'newsletter': return ctx.newsletterHtml || '';
    case 'callout': return `<aside class="callout">${esc(arg)}</aside>`;
    default: return null;
  }
}

function renderPlain(md) {
  const toc = [];
  return sanitize(createRenderer(toc).parse(String(md || '')));
}

module.exports = { render, renderPlain, autoAffiliate, sanitize };
