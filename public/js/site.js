/* TrendMind — JavaScript pubblico minimo (progressive enhancement: il sito funziona anche senza). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Tema chiaro/scuro
  var toggle = $('[data-theme-toggle]');
  if (toggle) toggle.addEventListener('click', function () {
    var root = document.documentElement;
    var current = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('tm-theme', next); } catch (e) { /* storage non disponibile */ }
  });

  // Newsletter via fetch (fallback: invio classico del form)
  $$('form[data-nl]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = $('.nl-msg', f);
      var btn = $('button', f);
      btn.disabled = true;
      fetch(f.action, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          msg.textContent = d.msg;
          if (d.ok) { f.reset(); if (window.plausible) window.plausible('Newsletter'); if (window.gtag) window.gtag('event', 'sign_up', { method: 'newsletter' }); }
        })
        .catch(function () { msg.textContent = 'Errore di rete, riprova.'; })
        .finally(function () { btn.disabled = false; });
    });
  });

  // Copia link / codice embed
  $$('[data-copy], [data-copy-from]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy') || (b.previousElementSibling && b.previousElementSibling.value) || '';
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
        var t = b.textContent; b.textContent = 'Copiato ✓'; setTimeout(function () { b.textContent = t; }, 1600);
      }).catch(function () { if (b.previousElementSibling && b.previousElementSibling.select) b.previousElementSibling.select(); });
    });
  });
  $$('textarea[data-select]').forEach(function (t) { t.addEventListener('focus', function () { t.select(); }); });

  // Evento analytics sui click affiliati
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-aff]');
    if (!a) return;
    var slug = a.getAttribute('data-aff');
    if (window.plausible) window.plausible('Affiliate Click', { props: { tool: slug } });
    if (window.gtag) window.gtag('event', 'affiliate_click', { tool: slug });
  });

  // Indice: evidenzia la sezione corrente
  var tocLinks = $$('.article-side .toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (l) { map[l.getAttribute('href').slice(1)] = l; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          tocLinks.forEach(function (l) { l.classList.remove('active'); });
          map[en.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-120px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Selettore confronto modelli
  $$('form[data-compare]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      var picked = $$('input[type=checkbox]:checked', f).map(function (c) { return c.value; });
      if (picked.length < 2) { e.preventDefault(); alert('Seleziona almeno 2 modelli.'); return; }
      $('input[name=m]', f).value = picked.slice(0, 4).join(',');
      $$('input[type=checkbox]', f).forEach(function (c) { c.disabled = true; });
    });
  });

  // Tabelle ordinabili
  $$('table[data-sortable]').forEach(function (table) {
    $$('thead th', table).forEach(function (th, idx) {
      th.setAttribute('tabindex', '0');
      var sort = function () {
        var asc = th.getAttribute('aria-sort') !== 'ascending';
        $$('thead th', table).forEach(function (x) { x.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var rows = $$('tbody tr', table);
        rows.sort(function (a, b) {
          var ca = a.children[idx], cb = b.children[idx];
          var va = ca.hasAttribute('data-v') ? parseFloat(ca.getAttribute('data-v')) : ca.textContent.trim().toLowerCase();
          var vb = cb.hasAttribute('data-v') ? parseFloat(cb.getAttribute('data-v')) : cb.textContent.trim().toLowerCase();
          return (va > vb ? 1 : va < vb ? -1 : 0) * (asc ? 1 : -1);
        });
        rows.forEach(function (r) { table.tBodies[0].appendChild(r); });
      };
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
    });
  });

  // Calcolatore costi API
  var calc = $('form[data-calc]');
  var calcTable = $('table[data-calc-table]');
  if (calc && calcTable) {
    var fmt = function (n, d) { return n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var run = function () {
      var v = function (n) { return Math.max(0, parseFloat(calc.elements[n].value) || 0); };
      var rpd = v('rpd'), tin = v('tin'), tout = v('tout'), fx = v('fx');
      var rows = $$('tbody tr', calcTable);
      var costs = rows.map(function (r) {
        var per = (tin * parseFloat(r.getAttribute('data-in')) + tout * parseFloat(r.getAttribute('data-out'))) / 1e6;
        return { r: r, per: per, month: per * rpd * 30 };
      });
      var max = Math.max.apply(null, costs.map(function (c) { return c.month; }).concat([0.0001]));
      costs.sort(function (a, b) { return a.month - b.month; });
      costs.forEach(function (c, i) {
        $('[data-cell=req]', c.r).textContent = '$' + fmt(c.per, 5);
        $('[data-cell=usd]', c.r).textContent = '$' + fmt(c.month, 2);
        $('[data-cell=eur] b', c.r) ? ($('[data-cell=eur] b', c.r).textContent = '€' + fmt(c.month * fx, 2)) : null;
        $('[data-cell=bar]', c.r).style.width = (c.month / max * 100) + '%';
        c.r.classList.toggle('best', i === 0);
        calcTable.tBodies[0].appendChild(c.r);
      });
    };
    calc.addEventListener('input', run);
    $$('[data-preset]', calc).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-preset').split(',');
        calc.elements.rpd.value = p[0]; calc.elements.tin.value = p[1]; calc.elements.tout.value = p[2]; run();
      });
    });
    run();
  }

  // Consenso cookie per Google Analytics 4 (caricato solo dopo "Accetta")
  var banner = $('[data-consent]');
  if (banner && window.TM_GA4) {
    var load = function () {
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(window.TM_GA4);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', window.TM_GA4, { anonymize_ip: true });
    };
    var choice = null;
    try { choice = localStorage.getItem('tm-consent'); } catch (e) { /* ignore */ }
    if (choice === 'yes') load();
    else if (choice !== 'no') banner.hidden = false;
    $('[data-consent-yes]', banner).addEventListener('click', function () { try { localStorage.setItem('tm-consent', 'yes'); } catch (e) { /* ignore */ } banner.hidden = true; load(); });
    $('[data-consent-no]', banner).addEventListener('click', function () { try { localStorage.setItem('tm-consent', 'no'); } catch (e) { /* ignore */ } banner.hidden = true; });
  }
})();
