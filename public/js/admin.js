/* CMS — editor articoli, punteggio live, anteprima, media picker. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CSRF = ($('meta[name=csrf]') || {}).content || '';
  var post = function (url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF, Accept: 'application/json' }, body: JSON.stringify(data) }).then(function (r) { return r.json(); });
  };
  var debounce = function (fn, ms) { var t; return function () { clearTimeout(t); var a = arguments; t = setTimeout(function () { fn.apply(null, a); }, ms); }; };

  // Conferme per azioni distruttive
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-confirm]');
    if (b && !confirm(b.getAttribute('data-confirm'))) e.preventDefault();
  });

  // Ripetitori (FAQ, passaggi, fonti)
  $$('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-add');
      var tpl = document.getElementById('tpl-' + key);
      var box = $('[data-repeater="' + key + '"]');
      box.appendChild(tpl.content.cloneNode(true));
      var inp = box.lastElementChild.querySelector('input, textarea');
      if (inp) inp.focus();
      update();
    });
  });
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('rep-del')) { e.target.closest('.rep-row').remove(); update(); }
  });

  var form = $('form[data-editor]');
  var update = function () {};

  if (form) {
    var f = function (n) { return $('[data-f="' + n + '"]', form); };
    var area = f('content');

    // ---------- Toolbar Markdown
    var wrap = function (before, after, placeholder) {
      var s = area.selectionStart, e = area.selectionEnd;
      var sel = area.value.slice(s, e) || placeholder || '';
      area.setRangeText(before + sel + (after || ''), s, e, 'end');
      area.focus();
      area.dispatchEvent(new Event('input'));
    };
    var linePrefix = function (prefix) {
      var s = area.selectionStart;
      var lineStart = area.value.lastIndexOf('\n', s - 1) + 1;
      area.setRangeText(prefix, lineStart, lineStart, 'end');
      area.focus();
      area.dispatchEvent(new Event('input'));
    };
    var actions = {
      h2: function () { linePrefix('## '); }, h3: function () { linePrefix('### '); },
      bold: function () { wrap('**', '**', 'testo'); }, italic: function () { wrap('_', '_', 'testo'); },
      link: function () { var u = prompt('URL del link (interno: /articoli/…, esterno: https://…)'); if (u) wrap('[', '](' + u + ')', 'testo del link'); },
      ul: function () { linePrefix('- '); }, ol: function () { linePrefix('1. '); }, quote: function () { linePrefix('> '); },
      table: function () { wrap('\n| Voce | Valore |\n|---|---|\n| A | 10 |\n| B | 20 |\n', '', ''); },
      image: function () { openMedia(function (m) { wrap('![' + (m.alt || 'descrizione immagine') + '](' + m.url + ')', '', ''); }); },
    };
    $$('[data-md]', form).forEach(function (b) { b.addEventListener('click', function () { actions[b.getAttribute('data-md')](); }); });
    var sc = $('[data-shortcode]', form);
    if (sc) sc.addEventListener('change', function () { if (sc.value) { wrap('\n\n' + sc.value + '\n\n', '', ''); sc.value = ''; } });

    // Scorciatoie da tastiera
    area.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); actions.bold(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); actions.italic(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); form.requestSubmit(); }
    });

    // ---------- Anteprima
    var prevBtn = $('[data-preview-toggle]', form);
    var prevBox = $('.md-preview', form);
    prevBtn.addEventListener('click', function () {
      var show = prevBox.hidden;
      if (show) {
        prevBox.innerHTML = '<p class="hint">Caricamento anteprima…</p>';
        post('/admin/api/anteprima', { content: area.value }).then(function (d) { prevBox.innerHTML = d.html; });
      }
      prevBox.hidden = !show; area.hidden = show;
      prevBtn.classList.toggle('on', show);
      prevBtn.textContent = show ? 'Modifica' : 'Anteprima';
    });

    // ---------- Contatori e anteprima SERP
    var counter = function (input, min, max) {
      var hint = $('[data-counter-for="' + input.name + '"]', form);
      var fn = function () {
        var n = input.value.length || (input.name === 'meta_title' ? f('title').value.length : (f('excerpt').value || '').length);
        hint.textContent = n + ' caratteri (ideale ' + min + '-' + max + ')';
        hint.className = 'hint ' + (n >= min && n <= max ? 'ok' : 'warn');
      };
      input.addEventListener('input', fn); fn();
    };
    counter(f('metaTitle'), 30, 62);
    counter(f('metaDesc'), 110, 160);
    var serp = function () {
      $('[data-serp-title]').textContent = (f('metaTitle').value || f('title').value || 'Titolo dell\'articolo').slice(0, 62);
      $('[data-serp-desc]').textContent = (f('metaDesc').value || f('excerpt').value || 'La meta description apparirà qui…').slice(0, 160);
      $('[data-serp-slug]').textContent = f('slug').value || slugify(f('title').value) || '…';
    };
    var slugify = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90); };

    // ---------- Punteggio SEO / AEO / GEO live
    var rings = { seo: $('[data-ring=seo]'), aeo: $('[data-ring=aeo]'), geo: $('[data-ring=geo]') };
    var list = $('[data-checklist]');
    var wc = $('[data-wordcount]');
    update = debounce(function () {
      var authorSel = f('author');
      var hasBio = authorSel && (authorSel.selectedOptions ? (authorSel.selectedOptions[0] || {}).dataset || {} : authorSel.dataset).bio === '1';
      var r = window.SeoAnalyzer.analyze({
        title: f('title').value, metaTitle: f('metaTitle').value, metaDescription: f('metaDesc').value, excerpt: f('excerpt').value,
        slug: f('slug').value || slugify(f('title').value), focusKeyword: f('kw').value, content: area.value, tldr: f('tldr').value, type: f('type').value,
        faqCount: $$('[data-repeater=faq] .rep-row', form).filter(function (row) { return row.querySelector('input').value.trim() && row.querySelector('textarea').value.trim(); }).length,
        takeawaysCount: f('takeaways').value.split('\n').filter(function (x) { return x.trim(); }).length,
        sourcesCount: $$('input[name="src_url[]"]', form).filter(function (i) { return /^https?:\/\//.test(i.value); }).length,
        hasAuthor: hasBio, coverImage: f('cover').value, coverAlt: f('coverAlt').value,
      });
      ['seo', 'aeo', 'geo'].forEach(function (k) {
        var v = r[k];
        rings[k].querySelector('b').textContent = v;
        rings[k].style.setProperty('--p', v);
        rings[k].className = 'ring ' + (v >= 80 ? 'good' : v >= 55 ? 'mid' : 'bad');
      });
      list.innerHTML = '';
      r.checks.sort(function (a, b) { return a.ok - b.ok || b.weight - a.weight; }).forEach(function (c) {
        var li = document.createElement('li');
        li.className = c.ok ? 'ok' : 'ko';
        li.innerHTML = '<span class="pill-p">' + c.pillar.toUpperCase() + '</span> <strong></strong>' + (c.ok ? '' : '<br><small></small>');
        li.querySelector('strong').textContent = c.label;
        if (!c.ok) li.querySelector('small').textContent = c.tip;
        list.appendChild(li);
      });
      wc.textContent = r.wordCount + ' parole · circa ' + Math.max(1, Math.round(r.wordCount / 220)) + ' min di lettura';
      serp();
      // contatore parole risposta rapida
      var tl = f('tldr'); var n = (tl.value.match(/[\p{L}\p{N}]+/gu) || []).length;
      tl.classList.toggle('warn-border', n > 0 && (n < 25 || n > 70));
    }, 250);
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();

    // Avviso modifiche non salvate
    var dirty = false;
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    // Copertina dalla libreria
    var coverBtn = $('[data-pick-cover]', form);
    if (coverBtn) coverBtn.addEventListener('click', function () {
      openMedia(function (m) {
        f('cover').value = m.url;
        if (!f('coverAlt').value && m.alt) f('coverAlt').value = m.alt;
        $('[data-cover-prev]').innerHTML = '<img src="' + m.url + '" alt="">';
        update();
      });
    });
    f('cover').addEventListener('change', function () { $('[data-cover-prev]').innerHTML = f('cover').value ? '<img src="' + f('cover').value.replace(/"/g, '') + '" alt="">' : ''; });
  }

  // ---------- Libreria media (dialog)
  var dlg = $('[data-media-dialog]');
  var onPick = null;
  function renderMedia() {
    var grid = $('[data-media-grid]', dlg);
    grid.innerHTML = '<p class="hint">Caricamento…</p>';
    fetch('/admin/api/media', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (items) {
      grid.innerHTML = items.length ? '' : '<p class="hint">Nessuna immagine. Caricane una qui sopra.</p>';
      items.forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'media-pick';
        b.innerHTML = '<img loading="lazy" alt="">';
        b.querySelector('img').src = m.url; b.title = m.original || m.filename;
        b.addEventListener('click', function () { dlg.close(); if (onPick) onPick(m); });
        grid.appendChild(b);
      });
    });
  }
  function openMedia(cb) {
    if (!dlg) return;
    onPick = cb; dlg.showModal(); renderMedia();
  }
  if (dlg) {
    $('[data-media-file]', dlg).addEventListener('change', function (e) {
      var fd = new FormData();
      Array.prototype.forEach.call(e.target.files, function (file) { fd.append('files', file); });
      fd.append('_csrf', CSRF);
      fetch('/admin/media/upload', { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function () { e.target.value = ''; renderMedia(); });
    });
  }

  // ---------- Anteprima grafico live (dataset)
  var dataForm = $('form[data-entity="dati"]');
  if (dataForm) {
    var box = $('[data-chart-preview]');
    var refresh = debounce(function () {
      var g = function (n) { return (dataForm.elements[n] || {}).value || ''; };
      post('/admin/api/grafico', { title: g('title'), chart_type: g('chart_type'), data_csv: g('data_csv'), unit: g('unit'), source_name: g('source_name') })
        .then(function (d) { box.innerHTML = d.svg; });
    }, 400);
    ['title', 'chart_type', 'data_csv', 'unit', 'source_name'].forEach(function (n) { if (dataForm.elements[n]) dataForm.elements[n].addEventListener('input', refresh); });
    if (!box.innerHTML.trim()) refresh();
  }
})();
