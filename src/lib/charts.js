'use strict';
/**
 * Infografiche SVG generate lato server.
 * - Nessun JavaScript lato client: il grafico è indicizzabile e leggero (Core Web Vitals).
 * - Palette categoriale validata per daltonismo (ordine fisso, mai ciclato).
 * - Barre sottili con estremità arrotondata 4px, linee 2px, griglia hairline.
 * - Tooltip nativi (<title>) e tabella dati accessibile generata a parte.
 */
const { esc } = require('./utils');

const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

function parseCsv(csv) {
  const rows = String(csv || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => (l.includes(';') && !l.includes(',') ? l.split(';') : l.split(',')).map((c) => c.trim()));
  if (!rows.length) return { labels: [], series: [] };
  const num = (v) => { const n = Number(String(v).replace(/\s/g, '').replace(/%$/, '')); return isFinite(n) ? n : null; };
  let header = null;
  if (rows[0].slice(1).some((c) => num(c) === null)) header = rows.shift();
  const nSeries = Math.max(1, ...rows.map((r) => r.length - 1));
  const series = Array.from({ length: nSeries }, (_, i) => ({ name: header?.[i + 1] || `Serie ${i + 1}`, values: [] }));
  const labels = [];
  for (const r of rows) {
    labels.push(r[0]);
    for (let i = 0; i < nSeries; i++) series[i].values.push(num(r[i + 1]));
  }
  return { labels, series: series.slice(0, 8), labelHeader: header?.[0] || '' };
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}
// numero di intervalli che produce tick "puliti" (0-5-10-…-25, 0-2-4-…-10)
function tickCount(max) {
  const lead = Math.round((max / Math.pow(10, Math.floor(Math.log10(max)))) * 10) / 10;
  return lead === 2 ? 4 : 5;
}
function fmt(n) {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' Mld';
  if (a >= 1e6) return (n / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' Mln';
  if (a >= 1e4) return (n / 1e3).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'K';
  return n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

// Stile incorporato: funziona sia inline nella pagina (tema chiaro/scuro) sia come file .svg incorporabile
function styleBlock() {
  const light = PALETTE.map((c, i) => `.tmc-s${i + 1}{fill:var(--viz-s${i + 1},${c})}.tmc-l${i + 1}{stroke:var(--viz-s${i + 1},${c})}`).join('');
  return `<style>.tmc-bg{fill:var(--viz-surface,#fcfcfb)}.tmc-grid{stroke:var(--viz-grid,#e4e3df);stroke-width:1}.tmc-axis{stroke:var(--viz-axis,#c9c8c2);stroke-width:1}`
    + `.tmc-t{font:500 15px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:var(--viz-text2,#52514e)}`
    + `.tmc-v{font:600 15px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:var(--viz-text1,#0b0b0b)}`
    + `.tmc-h{font:700 20px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:var(--viz-text1,#0b0b0b)}`
    + `.tmc-src{font:400 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:var(--viz-text3,#7a7974)}`
    + `.tmc-ring{stroke:var(--viz-surface,#fcfcfb);stroke-width:2}.tmc-line{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`
    + `.tmc-gap{stroke:var(--viz-surface,#fcfcfb);stroke-width:2}.tmc-hit:hover{opacity:.82}${light}</style>`;
}

// Barra con estremità dati arrotondata (4px) e base squadrata
function vBarPath(x, yTop, w, h) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + h}Z`;
}
function hBarPath(x, y, w, h) {
  const r = Math.min(4, h / 2, w);
  if (w <= 0) return '';
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

function legend(series, x, y, maxW) {
  if (series.length < 2) return { svg: '', h: 0 };
  let cx = x, cy = y, out = '';
  for (let i = 0; i < series.length; i++) {
    const w = 22 + series[i].name.length * 8.4 + 18;
    if (cx + w > x + maxW) { cx = x; cy += 24; }
    out += `<rect class="tmc-s${i + 1}" x="${cx}" y="${cy - 10}" width="12" height="12" rx="3"/><text class="tmc-t" x="${cx + 18}" y="${cy}">${esc(series[i].name)}</text>`;
    cx += w;
  }
  return { svg: out, h: cy - y + 28 };
}

/**
 * @param {object} ds dataset { title, chart_type, data_csv, unit, source_name }
 * @param {object} opts { standalone: bool, siteName, url }
 */
function renderChart(ds, opts = {}) {
  const W = 720;
  const data = parseCsv(ds.data_csv);
  const type = ds.chart_type || 'bar';
  const unit = ds.unit ? ` ${ds.unit}` : '';
  const title = esc(ds.title || '');
  const pad = { l: 64, r: 28, t: 64, b: 64 };
  let body = '';
  let H = 420;

  if (!data.labels.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 120" role="img"><text x="20" y="60">Nessun dato</text></svg>`;
  }

  const lg = legend(type === 'donut' ? [] : data.series, pad.l - 40, 68, W - pad.l - pad.r);
  const top = lg.h ? 68 + lg.h : pad.t;

  if (type === 'donut') {
    const s = data.series[0];
    const items = data.labels.map((l, i) => ({ l, v: Math.max(0, s.values[i] || 0) })).slice(0, 8);
    const total = items.reduce((a, b) => a + b.v, 0) || 1;
    H = Math.max(380, top + items.length * 34 + 40);
    const cx = 210, cy = top + 140, R = 128, r = 78;
    let a0 = -Math.PI / 2;
    items.forEach((it, i) => {
      const a1 = a0 + (it.v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`;
      const d = it.v >= total
        ? `M${cx - R},${cy}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0M${cx - r},${cy}a${r},${r} 0 1,1 ${2 * r},0a${r},${r} 0 1,1 ${-2 * r},0Z`
        : `M${p(R, a0)}A${R},${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large} 0 ${p(r, a0)}Z`;
      const pct = ((it.v / total) * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 });
      body += `<path class="tmc-s${i + 1} tmc-gap tmc-hit" d="${d}"><title>${esc(it.l)}: ${fmt(it.v)}${esc(unit)} (${pct}%)</title></path>`;
      const ly = top + 30 + i * 34;
      body += `<rect class="tmc-s${i + 1}" x="390" y="${ly - 12}" width="14" height="14" rx="3"/><text class="tmc-t" x="414" y="${ly}">${esc(it.l)}</text><text class="tmc-v" x="${W - pad.r}" y="${ly}" text-anchor="end">${pct}%</text>`;
      a0 = a1;
    });
    body += `<text class="tmc-v" x="${cx}" y="${cy + 6}" text-anchor="middle" style="font-size:22px">${fmt(total)}</text><text class="tmc-t" x="${cx}" y="${cy + 28}" text-anchor="middle">${esc(ds.unit || 'totale')}</text>`;
  } else if (type === 'hbar') {
    const s = data.series;
    const rowH = Math.max(30, s.length * 22 + 14);
    H = top + data.labels.length * rowH + pad.b - 10;
    const labelW = 170;
    const x0 = pad.l + labelW - 40, x1 = W - pad.r - 70;
    const max = niceMax(Math.max(0, ...s.flatMap((x) => x.values.filter((v) => v !== null))));
    const tc = tickCount(max);
    for (let t = 0; t <= tc; t++) {
      const x = x0 + ((x1 - x0) * t) / tc;
      body += `<line class="tmc-grid" x1="${x}" x2="${x}" y1="${top - 6}" y2="${H - pad.b + 14}"/><text class="tmc-t" x="${x}" y="${H - pad.b + 34}" text-anchor="middle">${fmt((max * t) / tc)}</text>`;
    }
    data.labels.forEach((l, i) => {
      const y = top + i * rowH;
      body += `<text class="tmc-t" x="${x0 - 12}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(l.length > 22 ? l.slice(0, 21) + '…' : l)}<title>${esc(l)}</title></text>`;
      const bh = Math.min(20, (rowH - 12) / s.length - 2);
      s.forEach((se, j) => {
        const v = se.values[i];
        if (v === null) return;
        const w = ((x1 - x0) * Math.max(0, v)) / max;
        const by = y + (rowH - s.length * (bh + 2)) / 2 + j * (bh + 2);
        body += `<path class="tmc-s${j + 1} tmc-hit" d="${hBarPath(x0, by, w, bh)}"><title>${esc(l)} — ${esc(se.name)}: ${fmt(v)}${esc(unit)}</title></path>`;
        if (s.length === 1) body += `<text class="tmc-v" x="${x0 + w + 8}" y="${by + bh / 2 + 5}">${fmt(v)}${esc(unit)}</text>`;
      });
    });
    body += `<line class="tmc-axis" x1="${x0}" x2="${x0}" y1="${top - 6}" y2="${H - pad.b + 14}"/>`;
  } else {
    // bar (colonne) e line
    const all = data.series.flatMap((x) => x.values.filter((v) => v !== null));
    const minV = Math.min(0, ...all);
    const max = niceMax(Math.max(...all, 0));
    const min = minV < 0 ? -niceMax(-minV) : 0;
    const x0 = pad.l, x1 = W - pad.r - (type === 'line' ? 60 : 0);
    const y0 = H - pad.b, y1 = top;
    const Y = (v) => y0 - ((v - min) / (max - min)) * (y0 - y1);
    const tc = tickCount(max - min);
    for (let t = 0; t <= tc; t++) {
      const v = min + ((max - min) * t) / tc;
      body += `<line class="tmc-grid" x1="${x0}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tmc-t" x="${x0 - 10}" y="${Y(v) + 5}" text-anchor="end">${fmt(v)}</text>`;
    }
    const n = data.labels.length;
    const step = (x1 - x0) / n;
    const every = Math.ceil(n / 8);
    data.labels.forEach((l, i) => {
      if (i === n - 1 || (i % every === 0 && n - 1 - i >= every)) body += `<text class="tmc-t" x="${x0 + step * i + step / 2}" y="${y0 + 26}" text-anchor="middle">${esc(l.length > 12 ? l.slice(0, 11) + '…' : l)}</text>`;
    });
    if (type === 'line') {
      data.series.forEach((se, j) => {
        const pts = se.values.map((v, i) => (v === null ? null : [x0 + step * i + step / 2, Y(v)]));
        let d = '', pen = false;
        pts.forEach((p) => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); pen = true; });
        body += `<path class="tmc-line tmc-l${j + 1}" d="${d}"/>`;
        pts.forEach((p, i) => {
          if (!p) return;
          const isLast = i === pts.length - 1 || pts.slice(i + 1).every((q) => !q);
          body += `<circle class="tmc-s${j + 1} ${isLast ? 'tmc-ring' : ''} tmc-hit" cx="${p[0]}" cy="${p[1]}" r="${isLast ? 5 : 9}" ${isLast ? '' : 'fill-opacity="0"'}><title>${esc(data.labels[i])} — ${esc(se.name)}: ${fmt(se.values[i])}${esc(unit)}</title></circle>`;
          if (isLast && data.series.length <= 4) body += `<text class="tmc-v" x="${p[0] + 10}" y="${p[1] + 5}">${fmt(se.values[i])}</text>`;
        });
      });
    } else {
      const k = data.series.length;
      const bw = Math.min(24, (step * 0.7) / k - 2);
      data.labels.forEach((l, i) => {
        const gx = x0 + step * i + (step - k * (bw + 2) + 2) / 2;
        data.series.forEach((se, j) => {
          const v = se.values[i];
          if (v === null) return;
          const x = gx + j * (bw + 2);
          const yTop = Y(Math.max(v, 0)), yBase = Y(Math.min(v, 0));
          const path = v >= 0 ? vBarPath(x, yTop, bw, yBase - yTop) : `M${x},${yTop}H${x + bw}V${yBase}H${x}Z`;
          body += `<path class="tmc-s${j + 1} tmc-hit" d="${path}"><title>${esc(l)} — ${esc(se.name)}: ${fmt(v)}${esc(unit)}</title></path>`;
          if (k === 1 && n <= 12) body += `<text class="tmc-v" x="${x + bw / 2}" y="${yTop - 8}" text-anchor="middle">${fmt(v)}</text>`;
        });
      });
    }
    body += `<line class="tmc-axis" x1="${x0}" x2="${W - pad.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  }

  const head = `<text class="tmc-h" x="${pad.l - 40}" y="34">${title}</text>`;
  const src = ds.source_name ? `Fonte: ${esc(ds.source_name)}${opts.siteName ? ' · Elaborazione ' + esc(opts.siteName) : ''}` : (opts.siteName ? esc(opts.siteName) : '');
  const foot = src ? `<text class="tmc-src" x="${pad.l - 40}" y="${H - 14}">${src}</text>` : '';
  const desc = esc(ds.insight || `${ds.title}: ${data.labels.length} valori`);
  const ns = 'xmlns="http://www.w3.org/2000/svg"';
  return `<svg ${ns} class="tm-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="tmc-title-${esc(ds.slug || 'x')}" preserveAspectRatio="xMidYMid meet">`
    + `<title id="tmc-title-${esc(ds.slug || 'x')}">${title}</title><desc>${desc}</desc>${styleBlock()}`
    + `<rect class="tmc-bg" width="${W}" height="${H}" rx="${opts.standalone ? 12 : 0}"/>${head}${lg.svg}${body}${foot}</svg>`;
}

// Tabella accessibile (e citabile dai motori AI) con gli stessi dati del grafico
function renderTable(ds) {
  const d = parseCsv(ds.data_csv);
  if (!d.labels.length) return '';
  const th = `<tr><th scope="col">${esc(d.labelHeader || 'Voce')}</th>${d.series.map((s) => `<th scope="col">${esc(s.name)}${ds.unit ? ` (${esc(ds.unit)})` : ''}</th>`).join('')}</tr>`;
  const rows = d.labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${d.series.map((s) => `<td>${fmt(s.values[i])}</td>`).join('')}</tr>`).join('');
  return `<table class="data-table"><caption>${esc(ds.title)}</caption><thead>${th}</thead><tbody>${rows}</tbody></table>`;
}

module.exports = { renderChart, renderTable, parseCsv, PALETTE, DARK };
