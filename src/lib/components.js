'use strict';
/** Componenti HTML riutilizzati da shortcode, template e pannello. */
const settings = require('./settings');
const { esc, lines, fmtNumber } = require('./utils');

function stars(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const pct = (r / 5) * 100;
  return `<span class="stars" role="img" aria-label="Valutazione ${r.toLocaleString('it-IT')} su 5"><span class="stars-fill" style="width:${pct}%"></span></span>`;
}

function toolBox(t, { compact = false } = {}) {
  if (!t) return '';
  const pros = lines(t.pros).slice(0, compact ? 2 : 4);
  const cons = lines(t.cons).slice(0, compact ? 1 : 3);
  return `<aside class="tool-box" data-tool="${esc(t.slug)}">
  <div class="tool-box-head">
    ${t.logo ? `<img src="${esc(t.logo)}" alt="Logo ${esc(t.name)}" width="48" height="48" loading="lazy">` : `<span class="tool-mono" aria-hidden="true">${esc(t.name.slice(0, 1))}</span>`}
    <div><p class="tool-box-name"><a href="/strumenti/${esc(t.slug)}">${esc(t.name)}</a></p>
    <p class="tool-box-tag">${esc(t.tagline || t.category || '')}</p></div>
    ${t.rating ? `<div class="tool-box-rating">${stars(t.rating)} <strong>${Number(t.rating).toLocaleString('it-IT')}</strong></div>` : ''}
  </div>
  ${pros.length || cons.length ? `<div class="pros-cons">
    ${pros.length ? `<ul class="pros" aria-label="Pro">${pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    ${cons.length ? `<ul class="cons" aria-label="Contro">${cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
  </div>` : ''}
  <div class="tool-box-foot">
    <span class="tool-price">${t.free_plan ? '<b class="badge badge-ok">Piano gratuito</b> ' : ''}${esc(t.pricing || '')}</span>
    ${t.coupon ? `<span class="coupon" title="Codice sconto">🎟 <code>${esc(t.coupon)}</code></span>` : ''}
    <a class="btn btn-cta" href="/go/${esc(t.slug)}" rel="sponsored nofollow" target="_blank" data-aff="${esc(t.slug)}">Prova ${esc(t.name)} →</a>
  </div>
</aside>`;
}

function modelCard(m) {
  if (!m) return '';
  return `<aside class="model-card">
  <p class="model-card-provider">${esc(m.provider || '')}</p>
  <p class="model-card-name"><a href="/modelli-ai/${esc(m.slug)}">${esc(m.name)}</a></p>
  <dl class="spec-grid">
    <div><dt>Contesto</dt><dd>${m.context_window ? fmtNumber(m.context_window) + ' token' : '—'}</dd></div>
    <div><dt>Input / 1M token</dt><dd>${m.input_price != null ? '$' + fmtNumber(m.input_price, 2) : '—'}</dd></div>
    <div><dt>Output / 1M token</dt><dd>${m.output_price != null ? '$' + fmtNumber(m.output_price, 2) : '—'}</dd></div>
    <div><dt>Pesi aperti</dt><dd>${m.open_weights ? 'Sì' : 'No'}</dd></div>
  </dl>
  ${m.verified ? '' : '<p class="note-warn">Dati dimostrativi in attesa di verifica redazionale.</p>'}
</aside>`;
}

function chartEmbed(ds, svg) {
  if (!ds) return '';
  return `<figure class="infographic">
  ${svg}
  <figcaption>${esc(ds.insight || ds.title)} ${ds.source_url ? `— <a href="${esc(ds.source_url)}" rel="noopener" target="_blank">${esc(ds.source_name || 'Fonte')}</a>` : ''} · <a href="/dati/${esc(ds.slug)}">Dati completi e codice di incorporamento</a></figcaption>
</figure>`;
}

function adSlot(position) {
  const s = settings.all();
  const slot = s[`ad_slot_${position}`];
  if (!s.adsense_client || !slot) return '';
  return `<div class="ad-slot ad-${esc(position)}" aria-label="Pubblicità"><span class="ad-label">Pubblicità</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(s.adsense_client)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
}

function newsletterBox(source = 'inline') {
  const s = settings.all();
  return `<section class="newsletter-box" aria-labelledby="nl-${esc(source)}">
  <div><p class="eyebrow">Newsletter gratuita</p><h2 id="nl-${esc(source)}">${esc(s.newsletter_title)}</h2><p>${esc(s.newsletter_text)}</p></div>
  <form class="nl-form" method="post" action="/newsletter" data-nl>
    <input type="hidden" name="source" value="${esc(source)}">
    <label class="sr-only" for="nl-email-${esc(source)}">La tua email</label>
    <input id="nl-email-${esc(source)}" type="email" name="email" required placeholder="nome@email.it" autocomplete="email">
    <input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <button class="btn btn-primary" type="submit">Iscriviti</button>
    <p class="nl-consent">Iscrivendoti accetti la <a href="/p/privacy">privacy policy</a>. Niente spam.</p>
    <p class="nl-msg" role="status" aria-live="polite"></p>
  </form>
</section>`;
}

module.exports = { stars, toolBox, modelCard, chartEmbed, adSlot, newsletterBox };
