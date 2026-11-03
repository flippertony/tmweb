// Dashboard di Jarvis — JavaScript semplice, senza librerie esterne.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(url, opzioni = {}) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opzioni,
    body: opzioni.body ? JSON.stringify(opzioni.body) : undefined });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

// Markdown essenziale per le risposte di Jarvis (il testo viene prima "ripulito").
function markdown(testo) {
  const righe = esc(testo).split("\n");
  let html = "", inLista = false;
  for (let r of righe) {
    r = r.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>")
         .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
         .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    const voce = r.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (voce) { if (!inLista) { html += "<ul>"; inLista = true; } html += `<li>${voce[1]}</li>`; continue; }
    if (inLista) { html += "</ul>"; inLista = false; }
    const titolo = r.match(/^#{1,4}\s+(.*)/);
    if (titolo) html += `<p><b>${titolo[1]}</b></p>`;
    else if (r.trim()) html += `<p>${r}</p>`;
  }
  return html + (inLista ? "</ul>" : "");
}

// ---------- Navigazione ----------
function mostra(vista) {
  $$("nav button").forEach((b) => b.classList.toggle("attiva", b.dataset.vista === vista));
  $$(".vista").forEach((v) => v.classList.toggle("attiva", v.id === `vista-${vista}`));
  ({ approvazioni: caricaApprovazioni, notifiche: caricaNotifiche, crm: caricaCrm, siti: caricaSiti,
     automazioni: caricaAutomazioni, registro: caricaRegistro, chat: caricaConversazioni })[vista]?.();
}
$$("nav button").forEach((b) => (b.onclick = () => mostra(b.dataset.vista)));

// ---------- Stato ----------
async function aggiornaStato() {
  try {
    const s = await api("/api/stato");
    const sn = (v, si = "collegato", no = "da collegare") => v ? `<span class="si">● ${si}</span>` : `<span class="no">● ${no}</span>`;
    $("#stato").innerHTML = `Claude: ${sn(s.chiave_api, "ok", "manca chiave API")}<br>
      Google: ${sn(s.google)}<br>Siti monitorati: ${s.siti}<br>Autonomia: livello ${s.autonomia}<br>
      Spesa oggi: $${s.spesa_oggi.toFixed(2)} / ${s.budget}`;
    $("#badge-appr").textContent = s.approvazioni_in_attesa || "";
    $("#badge-not").textContent = s.notifiche_non_lette || "";
    $("#btn-pausa").classList.toggle("attiva", s.pausa);
    $("#btn-pausa").textContent = s.pausa ? "▶ Riattiva Jarvis" : "⏸ Pausa di emergenza";
    $("#btn-pausa").dataset.pausa = s.pausa ? "1" : "";
  } catch (e) { $("#stato").textContent = "Jarvis non risponde"; }
}
$("#btn-pausa").onclick = async () => {
  const attiva = !$("#btn-pausa").dataset.pausa;
  if (attiva && !confirm("Mettere in pausa Jarvis? Le automazioni si fermano e ogni azione chiederà approvazione.")) return;
  await api("/api/pausa", { method: "POST", body: { attiva } });
  aggiornaStato();
};
setInterval(aggiornaStato, 15000);

// ---------- Chat ----------
let conversazioneId = null;
const elMsg = $("#messaggi");

function aggiungiMessaggio(ruolo, testo, extra = "") {
  $(".benvenuto", elMsg)?.remove();
  const d = document.createElement("div");
  d.className = `msg ${ruolo} ${extra}`;
  if (ruolo === "jarvis") d.innerHTML = markdown(testo);
  else if (ruolo === "azione") d.textContent = `🔧 ${testo}`;
  else d.textContent = testo;
  elMsg.appendChild(d);
  elMsg.scrollTop = elMsg.scrollHeight;
  return d;
}

async function invia(testo) {
  if (!testo.trim()) return;
  aggiungiMessaggio("utente", testo);
  $("#testo").value = ""; $("#testo").style.height = "auto";
  const pensa = aggiungiMessaggio("pensando", "");
  pensa.innerHTML = '<span class="nucleo pensa"></span> Jarvis sta lavorando…';
  try {
    const r = await api("/api/chat", { method: "POST", body: { testo, conversazione_id: conversazioneId } });
    pensa.remove();
    conversazioneId = r.conversazione_id;
    r.azioni.forEach((a) => aggiungiMessaggio("azione", a.in_coda ? `${a.strumento} → in attesa di approvazione` : a.strumento + (a.errore ? " (errore)" : ""), a.in_coda ? "coda" : ""));
    aggiungiMessaggio("jarvis", r.risposta || "(nessuna risposta)");
    parla(r.risposta);
    caricaConversazioni(); aggiornaStato();
  } catch (e) {
    pensa.remove();
    aggiungiMessaggio("jarvis", "⚠️ Errore: " + e.message);
  }
}

$("#form-chat").onsubmit = (e) => { e.preventDefault(); invia($("#testo").value); };
$("#testo").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); invia($("#testo").value); } });
$("#testo").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; });
$$(".suggerimenti button").forEach((b) => (b.onclick = () => invia(b.textContent)));
$("#nuova-chat").onclick = () => {
  conversazioneId = null;
  elMsg.innerHTML = '<div class="benvenuto"><div class="nucleo grande"></div><h1>Nuova conversazione</h1><p>Di cosa ti occupi oggi?</p></div>';
  $$("#lista-conv li").forEach((l) => l.classList.remove("attiva"));
};

async function caricaConversazioni() {
  const lista = await api("/api/conversazioni");
  $("#lista-conv").innerHTML = lista.map((c) => `<li data-id="${c.id}" class="${c.id === conversazioneId ? "attiva" : ""}">
    ${c.origine.startsWith("automazione") ? "🤖 " : ""}${esc(c.titolo)}<small>${esc(c.aggiornata_il.replace("T", " ").slice(0, 16))}</small></li>`).join("");
  $$("#lista-conv li").forEach((li) => (li.onclick = () => apriConversazione(+li.dataset.id)));
}

async function apriConversazione(id) {
  conversazioneId = id;
  const msgs = await api(`/api/conversazioni/${id}`);
  elMsg.innerHTML = "";
  msgs.forEach((m) => aggiungiMessaggio(m.ruolo, m.testo));
  caricaConversazioni();
}

// ---------- Voce (riconoscimento e sintesi del browser, gratis) ----------
const Riconoscimento = window.SpeechRecognition || window.webkitSpeechRecognition;
let ascolto = null;
$("#btn-mic").onclick = () => {
  if (!Riconoscimento) return alert("Il riconoscimento vocale funziona in Chrome o Edge.");
  if (ascolto) { ascolto.stop(); return; }
  ascolto = new Riconoscimento();
  ascolto.lang = "it-IT"; ascolto.interimResults = true;
  $("#btn-mic").classList.add("ascolta");
  ascolto.onresult = (e) => {
    const t = [...e.results].map((r) => r[0].transcript).join("");
    $("#testo").value = t;
    if (e.results[e.results.length - 1].isFinal) { ascolto.stop(); invia(t); }
  };
  ascolto.onend = () => { ascolto = null; $("#btn-mic").classList.remove("ascolta"); };
  ascolto.start();
};
try { $("#leggi-risposte").checked = localStorage.getItem("jarvis-voce") === "1"; } catch {}
$("#leggi-risposte").onchange = (e) => { try { localStorage.setItem("jarvis-voce", e.target.checked ? "1" : "0"); } catch {} };
function parla(testo) {
  if (!$("#leggi-risposte").checked || !window.speechSynthesis || !testo) return;
  const u = new SpeechSynthesisUtterance(testo.replace(/[*#`_>]/g, "").replace(/https?:\/\/\S+/g, "link").slice(0, 1500));
  u.lang = "it-IT";
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

// ---------- Approvazioni ----------
let statoApprovazioni = "in_attesa";
$$("[data-stato]").forEach((b) => (b.onclick = () => {
  statoApprovazioni = b.dataset.stato;
  $$("[data-stato]").forEach((x) => x.classList.toggle("attiva", x === b));
  caricaApprovazioni();
}));

async function caricaApprovazioni() {
  const lista = await api(`/api/approvazioni?stato=${statoApprovazioni}`);
  $("#lista-approvazioni").innerHTML = lista.length ? lista.map((a) => {
    let dati; try { dati = JSON.stringify(JSON.parse(a.input), null, 2); } catch { dati = a.input; }
    return `<div class="scheda approvazione"><h4><span>#${a.id} · ${esc(a.strumento)}</span><span class="meta">${esc(a.creata_il.replace("T", " "))}</span></h4>
      <div class="meta">Motivo: ${esc(a.motivo)}</div><pre>${esc(dati)}</pre>
      ${a.stato === "in_attesa" ? `<div class="azioni"><button class="ok" data-approva="${a.id}">Approva ed esegui</button><button data-rifiuta="${a.id}">Rifiuta</button></div>` : `<div class="meta">Esito: ${esc(a.esito || a.stato)}</div>`}</div>`;
  }).join("") : '<p class="nota">Niente da approvare. 👍</p>';
  $$("[data-approva]").forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = "Eseguo…";
    const r = await api(`/api/approvazioni/${b.dataset.approva}/approva`, { method: "POST" });
    alert(r.esito); caricaApprovazioni(); aggiornaStato();
  }));
  $$("[data-rifiuta]").forEach((b) => (b.onclick = async () => {
    await api(`/api/approvazioni/${b.dataset.rifiuta}/rifiuta`, { method: "POST" });
    caricaApprovazioni(); aggiornaStato();
  }));
}

// ---------- Notifiche ----------
async function caricaNotifiche() {
  const lista = await api("/api/notifiche");
  $("#lista-notifiche").innerHTML = lista.length ? lista.map((n) => `<div class="scheda ${esc(n.livello)} ${n.letta ? "" : "non-letta"}">
    <h4><span>${esc(n.titolo)}</span><span class="meta">${esc(n.quando.replace("T", " ").slice(0, 16))}</span></h4>
    ${n.testo ? `<div class="testo">${n.livello === "automazione" ? markdown(n.testo) : esc(n.testo)}</div>` : ""}</div>`).join("")
    : '<p class="nota">Nessuna notifica.</p>';
  await api("/api/notifiche/lette", { method: "POST" });
  aggiornaStato();
}

// ---------- CRM ----------
const FASI = ["nuovo", "contattato", "preventivo", "trattativa", "vinto", "perso"];
$$("[data-crm]").forEach((b) => (b.onclick = () => {
  $$("[data-crm]").forEach((x) => x.classList.toggle("attiva", x === b));
  $("#crm-pipeline").classList.toggle("nascosto", b.dataset.crm !== "pipeline");
  $("#crm-contatti").classList.toggle("nascosto", b.dataset.crm !== "contatti");
}));
const euro = (v) => (v || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

async function caricaCrm() {
  const p = await api("/api/crm/pipeline");
  $("#crm-pipeline").innerHTML = FASI.map((f) => `<div class="colonna"><h4>${f}</h4>
    <div class="tot">${p[f].length} · ${euro(p[f].reduce((s, o) => s + (o.valore || 0), 0))}</div>
    ${p[f].map((o) => `<div class="carta"><b>${esc(o.titolo)}</b><small>${esc(o.contatto || "")}${o.azienda ? " · " + esc(o.azienda) : ""}</small>
      <small>${euro(o.valore)}${o.data_prossima_azione ? " · ⏰ " + esc(o.data_prossima_azione) : ""}</small>
      ${o.prossima_azione ? `<small>→ ${esc(o.prossima_azione)}</small>` : ""}
      <select data-op="${o.id}">${FASI.map((x) => `<option ${x === f ? "selected" : ""}>${x}</option>`).join("")}</select></div>`).join("")}
  </div>`).join("");
  $$("[data-op]").forEach((s) => (s.onchange = async () => {
    await api(`/api/crm/opportunita/${s.dataset.op}`, { method: "PUT", body: { fase: s.value } });
    caricaCrm();
  }));
  caricaContatti();
}

async function caricaContatti() {
  const lista = await api(`/api/crm/contatti?cerca=${encodeURIComponent($("#cerca-contatti").value)}`);
  $("#tab-contatti").innerHTML = lista.map((c) => `<tr data-id="${c.id}"><td>${esc(c.nome)}</td><td>${esc(c.azienda)}</td>
    <td>${esc(c.email)}</td><td>${esc(c.telefono)}</td><td><span class="etichetta">${esc(c.stato)}</span></td><td>${esc(c.tag)}</td></tr>`).join("")
    || '<tr><td colspan="6" class="nota">Nessun contatto. Aggiungine uno o chiedi a Jarvis di importarli dalle email.</td></tr>';
  $$("#tab-contatti tr[data-id]").forEach((tr) => (tr.onclick = () => apriContatto(+tr.dataset.id)));
}
let timerCerca;
$("#cerca-contatti").oninput = () => { clearTimeout(timerCerca); timerCerca = setTimeout(caricaContatti, 250); };
$("#nuovo-contatto").onclick = () => apriContatto(null);

async function apriContatto(id) {
  const f = $("#form-contatto");
  f.reset(); f.id.value = id || "";
  $("#storico-contatto").innerHTML = "";
  $("#titolo-contatto").textContent = id ? "Modifica contatto" : "Nuovo contatto";
  if (id) {
    const s = await api(`/api/crm/contatti/${id}`);
    for (const [k, v] of Object.entries(s.contatto)) if (f[k] && k !== "id") f[k].value = v ?? "";
    $("#storico-contatto").innerHTML = [
      ...s.opportunita.map((o) => `💼 ${esc(o.titolo)} — ${esc(o.fase)} ${euro(o.valore)}`),
      ...s.attivita.map((a) => `• ${esc(a.data.slice(0, 10))} ${esc(a.tipo)}: ${esc(a.descrizione)}`),
    ].join("<br>");
  }
  $("#dlg-contatto").showModal();
}
$("#dlg-contatto").onclose = async () => {
  if ($("#dlg-contatto").returnValue !== "salva") return;
  const f = $("#form-contatto");
  const dati = Object.fromEntries(new FormData(f));
  const id = dati.id; delete dati.id;
  await api(id ? `/api/crm/contatti/${id}` : "/api/crm/contatti", { method: id ? "PUT" : "POST", body: dati });
  caricaContatti();
};

// ---------- Siti ----------
function disegnaSiti(lista) {
  $("#griglia-siti").innerHTML = lista.length ? lista.map((s) => `<div class="scheda sito">
    <h4><span><span class="pallino ${s.online ? "on" : "off"}"></span>${esc(s.sito)}</span></h4>
    <div class="meta"><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:inherit">${esc(s.url)}</a></div>
    <div class="riga">Risposta: ${s.tempo_ms ? s.tempo_ms + " ms" : "—"} · HTTP ${s.codice ?? "—"}<br>
    SSL: ${s.ssl_giorni != null ? s.ssl_giorni + " giorni alla scadenza" : "—"}</div>
    ${s.problemi.length ? `<div class="problema">⚠️ ${esc(s.problemi.join(", "))}</div>` : ""}
    ${s.errore ? `<div class="meta">${esc(s.errore)}</div>` : ""}
    <div class="meta">Controllato: ${esc(s.quando.replace("T", " ").slice(0, 16))}</div></div>`).join("")
    : '<p class="nota">Nessun sito controllato. Aggiungili in config/siti.yaml.</p>';
}
async function caricaSiti() { disegnaSiti(await api("/api/siti")); }
$("#controlla-siti").onclick = async (e) => {
  e.target.disabled = true; e.target.textContent = "Controllo…";
  disegnaSiti(await api("/api/siti/controlla", { method: "POST" }));
  e.target.disabled = false; e.target.textContent = "Controlla ora";
};

// ---------- Automazioni ----------
async function caricaAutomazioni() {
  const lista = await api("/api/automazioni");
  $("#lista-automazioni").innerHTML = lista.map((a) => `<div class="scheda"><h4><span>${a.attiva ? "🟢" : "⚪"} ${esc(a.titolo)}</span>
    <button class="piccolo" data-esegui="${esc(a.nome)}">Esegui ora</button></h4>
    <div class="meta">Quando: <code>${esc(a.quando)}</code>${a.prossima ? " · prossima: " + esc(a.prossima.replace("T", " ").slice(0, 16)) : ""}</div>
    <pre>${esc(a.prompt)}</pre></div>`).join("");
  $$("[data-esegui]").forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = "In esecuzione…";
    const r = await api(`/api/automazioni/${b.dataset.esegui}/esegui`, { method: "POST" });
    b.disabled = false; b.textContent = "Esegui ora";
    if (r.saltata) alert("Non eseguita: " + r.saltata);
    else if (r.conversazione_id) { mostra("chat"); apriConversazione(r.conversazione_id); }
  }));
}

// ---------- Registro ----------
async function caricaRegistro() {
  const lista = await api("/api/registro");
  $("#tab-registro").innerHTML = lista.map((r) => `<tr><td>${esc(r.quando.replace("T", " ").slice(0, 16))}</td>
    <td>${r.errore ? "❌" : "✔️"} ${esc(r.strumento)}</td><td class="lungo" title="${esc(r.input)}">${esc(r.input)}</td>
    <td class="lungo" title="${esc(r.esito)}">${esc(r.esito)}</td></tr>`).join("")
    || '<tr><td colspan="4" class="nota">Ancora nessuna azione.</td></tr>';
}

aggiornaStato();
caricaConversazioni();
