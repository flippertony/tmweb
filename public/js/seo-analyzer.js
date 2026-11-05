/**
 * Analizzatore SEO · AEO · GEO
 * Condiviso tra server (Node) e editor del pannello (browser) per un punteggio identico.
 *  - SEO: ottimizzazione per i motori di ricerca classici
 *  - AEO: Answer Engine Optimization (featured snippet, People Also Ask, assistenti vocali)
 *  - GEO: Generative Engine Optimization (farsi citare da ChatGPT, Perplexity, Gemini, Claude…)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SeoAnalyzer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function words(s) { return (String(s || '').match(/[\p{L}\p{N}]+/gu) || []); }
  // forma canonica: minuscolo, senza accenti, solo parole separate da spazio (gestisce apostrofi e trattini)
  var STOP = ['di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'gli', 'le', 'un', 'uno', 'una', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'nel', 'nella', 'nei', 'come', 'che', 'the', 'of', 'and', 'to', 'for'];
  function nk(s) { return words(norm(s)).join(' '); }
  function hasAll(hay, kwWords) { var h = ' ' + nk(hay) + ' '; return kwWords.every(function (w) { return h.indexOf(' ' + w + ' ') !== -1; }); }
  function plain(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[\[[^\]]+\]\]/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~|]+/g, ' ');
  }

  function analyze(d) {
    const md = String(d.content || '');
    const text = plain(md);
    const w = words(text);
    const wc = w.length;
    const kw = nk(d.focusKeyword);
    const kwCore = words(kw).filter(function (x) { return x.length > 1 && STOP.indexOf(x) === -1; });
    const kwWords = words(kw).length || 1;
    const title = d.metaTitle || d.title || '';
    const desc = d.metaDescription || d.excerpt || '';
    const h2 = (md.match(/^##\s+.+$/gm) || []).map((h) => h.replace(/^##\s+/, ''));
    const h3 = (md.match(/^###\s+.+$/gm) || []);
    const links = md.match(/\[[^\]]*\]\(([^)]+)\)/g) || [];
    const internal = links.filter((l) => /\]\((\/|#)/.test(l)).length + (md.match(/\[\[(tool|chart|model):/g) || []).length;
    const external = links.filter((l) => /\]\(https?:\/\//.test(l)).length;
    const images = md.match(/!\[([^\]]*)\]\(/g) || [];
    const imagesNoAlt = images.filter((i) => /!\[\s*\]/.test(i)).length;
    const first = nk(w.slice(0, 100).join(' '));
    const tldrWords = words(d.tldr).length;
    const sentences = text.split(/[.!?]+\s/).map((s) => words(s).length).filter((n) => n > 0);
    const avgSentence = sentences.length ? sentences.reduce((a, b) => a + b, 0) / sentences.length : 0;
    const hasList = /^\s*([-*+]|\d+\.)\s+/m.test(md);
    const hasTable = /^\s*\|.+\|\s*$/m.test(md);
    const numbers = (text.match(/\d+([.,]\d+)?\s?(%|€|\$|mila|milioni|miliardi|mld|mln)/gi) || []).length;
    const questionH2 = h2.filter((h) => /\?\s*$/.test(h)).length;
    const quotes = (md.match(/^>\s+/gm) || []).length;
    const isNews = d.type === 'news';
    const minWords = isNews ? 350 : 900;

    let density = 0;
    if (kw && wc) {
      const hay = ' ' + nk(w.join(' ')) + ' ';
      const occ = hay.split(' ' + kw + ' ').length - 1;
      density = (occ * kwWords * 100) / wc;
    }

    const checks = [];
    const add = (pillar, ok, label, tip, weight = 1) => checks.push({ pillar, ok: !!ok, label, tip, weight });

    // ---- SEO
    add('seo', kw, 'Parola chiave principale impostata', 'Scegli una keyword focus: guida tutte le altre verifiche.', 2);
    add('seo', title.length >= 30 && title.length <= 62, `Lunghezza titolo SEO (${title.length}/30-62)`, 'Titolo tra 30 e 62 caratteri per non essere troncato su Google.');
    add('seo', desc.length >= 110 && desc.length <= 160, `Meta description (${desc.length}/110-160)`, 'Descrizione tra 110 e 160 caratteri con un beneficio chiaro e una call to action.');
    add('seo', kw && nk(title).includes(kw), 'Keyword nel titolo', 'Inserisci la keyword nel titolo, possibilmente all\'inizio.', 2);
    add('seo', kw && nk(desc).includes(kw), 'Keyword nella meta description', 'Google evidenzia in grassetto la keyword nello snippet.');
    add('seo', kw && kwCore.length > 0 && hasAll(d.slug, kwCore), 'Keyword nello slug (URL)', 'URL brevi e descrittivi che contengono la keyword.');
    add('seo', kw && first.includes(kw), 'Keyword nelle prime 100 parole', 'Cita la keyword nel primo paragrafo.');
    add('seo', kw && h2.some((h) => nk(h).includes(kw) || (kwCore.length > 1 && hasAll(h, kwCore))), 'Keyword in almeno un H2', 'Usa la keyword (o una variante) in un sottotitolo.');
    add('seo', !kw || (density >= 0.4 && density <= 2.8), `Densità keyword ${density.toFixed(1)}% (0,4-2,8%)`, 'Evita keyword stuffing; usa sinonimi e varianti semantiche.');
    add('seo', wc >= minWords, `Lunghezza contenuto: ${wc} parole (min ${minWords})`, isNews ? 'Le news rendono meglio sopra le 350 parole con contesto e impatto.' : 'Guide e analisi complete superano le 900 parole.', 2);
    add('seo', h2.length >= 2, `Struttura con sottotitoli H2 (${h2.length})`, 'Dividi il testo in sezioni H2/H3 scansionabili.');
    add('seo', internal >= 2, `Link interni (${internal})`, 'Collega almeno 2 contenuti correlati: distribuisce autorità e aumenta le pagine viste.');
    add('seo', external + (d.sourcesCount || 0) >= 1, `Link esterni o fonti autorevoli (${external + (d.sourcesCount || 0)})`, 'Collega fonti primarie (studi, dati ufficiali, documentazione).');
    add('seo', !!d.coverImage && !!d.coverAlt, 'Immagine di copertina con testo alternativo', 'Aggiungi copertina 1200×630 e alt descrittivo: serve a Discover e ai social.');
    add('seo', imagesNoAlt === 0, 'Tutte le immagini hanno l\'alt', 'Descrivi ogni immagine nel testo alternativo.');

    // ---- AEO
    add('aeo', tldrWords >= 25 && tldrWords <= 70, `Risposta rapida (${tldrWords}/25-70 parole)`, 'Una risposta diretta e autonoma di 40-60 parole: è ciò che Google e gli assistenti leggono come snippet.', 3);
    add('aeo', (d.faqCount || 0) >= 3, `FAQ strutturate (${d.faqCount || 0}/3+)`, 'Aggiungi almeno 3 domande reali (People Also Ask) con risposte brevi: genera schema FAQPage.', 2);
    add('aeo', questionH2 >= 1, `Sottotitoli in forma di domanda (${questionH2})`, 'Formula almeno un H2 come domanda reale degli utenti ("Come…?", "Quanto costa…?").', 2);
    add('aeo', (d.takeawaysCount || 0) >= 3, `Punti chiave (${d.takeawaysCount || 0}/3+)`, 'Riassumi l\'articolo in 3-5 punti chiave scansionabili.');
    add('aeo', hasList || hasTable, 'Elenchi o tabelle presenti', 'Liste numerate e tabelle sono il formato preferito per snippet e risposte vocali.');
    add('aeo', avgSentence > 0 && avgSentence <= 24, `Frasi brevi (media ${avgSentence.toFixed(0)} parole)`, 'Frasi sotto le 24 parole: più facili da estrarre come risposta.');

    // ---- GEO
    add('geo', (d.sourcesCount || 0) >= 2, `Fonti citate (${d.sourcesCount || 0}/2+)`, 'I motori generativi citano più volentieri contenuti che a loro volta citano fonti verificabili.', 3);
    add('geo', numbers >= 3, `Dati e statistiche nel testo (${numbers})`, 'Inserisci numeri concreti con unità (%, €, milioni): aumentano la probabilità di citazione nelle risposte AI.', 2);
    add('geo', !!d.hasAuthor, 'Autore con biografia (E-E-A-T)', 'Associa un autore con competenze e profili verificabili.', 2);
    add('geo', quotes >= 1 || hasTable, 'Citazioni o tabelle comparative', 'Una citazione di esperto (blockquote) o una tabella comparativa rende il contenuto più "estraibile".');
    add('geo', kw && words(d.tldr).length > 0 && nk(d.tldr).includes(kwCore[0] || kw.split(' ')[0]), 'Entità principale definita nella risposta rapida', 'Nella risposta rapida nomina esplicitamente l\'argomento (es. "Il GEO è…").');
    add('geo', h2.length >= 3 || h3.length >= 2, 'Contenuto suddiviso in blocchi autonomi', 'Sezioni brevi e autosufficienti sono più facili da citare come passaggi.');

    const score = (p) => {
      const list = checks.filter((c) => c.pillar === p);
      const tot = list.reduce((a, c) => a + c.weight, 0);
      const ok = list.filter((c) => c.ok).reduce((a, c) => a + c.weight, 0);
      return tot ? Math.round((ok / tot) * 100) : 0;
    };
    const seo = score('seo'), aeo = score('aeo'), geo = score('geo');
    return { seo, aeo, geo, total: Math.round(seo * 0.45 + aeo * 0.25 + geo * 0.3), wordCount: wc, checks };
  }

  return { analyze: analyze };
});
