"""Il cervello di Jarvis: conversazione con Claude e uso degli strumenti."""
from __future__ import annotations

import json
import threading
from collections import defaultdict
from datetime import datetime

import anthropic

from . import config, db, tools
from .tools.memoria import elenco_file

MAX_GIRI = 25  # massimo di passaggi strumento -> risposta per singola richiesta
GIORNI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto",
        "settembre", "ottobre", "novembre", "dicembre"]

# Strumenti eseguiti dai server di Anthropic: ricerca e lettura di pagine web.
STRUMENTI_SERVER = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 5},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 5},
]

_client: anthropic.Anthropic | None = None
_lock_conversazioni: dict[int, threading.Lock] = defaultdict(threading.Lock)


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def adesso() -> str:
    n = datetime.now()
    return f"{GIORNI[n.weekday()]} {n.day} {MESI[n.month - 1]} {n.year}, ore {n:%H:%M}"


def _leggi_memoria(file: str) -> str:
    p = config.CARTELLA_MEMORIA / file
    return p.read_text(encoding="utf-8").strip() if p.exists() else ""


def prompt_di_sistema() -> str:
    """Costruito all'inizio di ogni conversazione e poi congelato, così la cache resta valida."""
    livelli = {1: "1 (Prepara: agisci da solo solo per leggere)",
               2: "2 (Agisci da solo su CRM, memoria e bozze)",
               3: "3 (Agisci da solo anche su sistemi esterni, es. bozze WordPress)"}
    siti = sorted((config.siti().get("siti") or {}).keys())
    return f"""{_leggi_memoria('identita.md')}

# Chi è il tuo utente
{_leggi_memoria('profilo.md') or '(profilo ancora da compilare: chiedi all utente di presentarsi e salva in profilo.md)'}

# Lezioni imparate dai feedback
{_leggi_memoria('lezioni.md') or '(nessuna ancora)'}

# Contesto operativo
- Livello di autonomia attuale: {livelli.get(config.AUTONOMIA, config.AUTONOMIA)}.
  Le azioni oltre il livello finiscono nella coda approvazioni: è normale, dillo all'utente.
- Siti/negozi dei clienti configurati: {', '.join(siti) or 'nessuno'}.
- File di memoria disponibili (leggili con memoria_leggi quando servono):
{chr(10).join('  - ' + f for f in elenco_file())}
"""


def _nuova_conversazione(primo_testo: str, origine: str) -> int:
    return db.esegui(
        "INSERT INTO conversazioni(titolo, origine, system, messaggi, creata_il, aggiornata_il) "
        "VALUES(?,?,?,?,?,?)",
        (primo_testo[:70], origine, prompt_di_sistema(), "[]", db.ora(), db.ora()))


def _salva(conv_id: int, messaggi: list) -> None:
    db.esegui("UPDATE conversazioni SET messaggi=?, aggiornata_il=? WHERE id=?",
              (json.dumps(messaggi, ensure_ascii=False), db.ora(), conv_id))


def _costo(r) -> float:
    p = config.PREZZI.get(config.MODELLO, config.PREZZI["claude-opus-5-5"])
    u = r.usage
    costo = ((u.input_tokens or 0) * p["input"] + (u.output_tokens or 0) * p["output"]
             + (getattr(u, "cache_read_input_tokens", 0) or 0) * p["cache_read"]
             + (getattr(u, "cache_creation_input_tokens", 0) or 0) * p["cache_write"]) / 1_000_000
    stu = getattr(u, "server_tool_use", None)
    if stu is not None:
        costo += (getattr(stu, "web_search_requests", 0) or 0) * 0.01
    return costo


def rispondi(testo: str, conversazione_id: int | None = None, origine: str = "chat",
             effort: str | None = None) -> dict:
    """Invia un messaggio a Jarvis e restituisce la risposta finale e le azioni svolte."""
    if conversazione_id is None:
        conversazione_id = _nuova_conversazione(testo, origine)

    with _lock_conversazioni[conversazione_id]:
        conv = db.riga("SELECT * FROM conversazioni WHERE id=?", (conversazione_id,))
        if conv is None:
            raise ValueError("Conversazione non trovata")
        messaggi = json.loads(conv["messaggi"])
        # La data va nel messaggio (non nel prompt di sistema) per non invalidare la cache.
        messaggi.append({"role": "user", "content": f"[{adesso()}]\n{testo}"})
        _salva(conversazione_id, messaggi)

        azioni: list[dict] = []
        risposta = ""
        for _ in range(MAX_GIRI):
            try:
                r = client().beta.messages.create(
                    model=config.MODELLO,
                    max_tokens=16000,
                    system=conv["system"],
                    tools=tools.definizioni() + STRUMENTI_SERVER,
                    messages=messaggi,
                    output_config={"effort": effort or config.EFFORT_CHAT},
                    cache_control={"type": "ephemeral"},
                    # se il modello rifiuta per un falso positivo dei filtri, riprova su un altro modello
                    betas=["server-side-fallback-2026-07-01"],
                    fallbacks="default",
                )
            except anthropic.AuthenticationError:
                risposta = "⚠️ Chiave API non valida: controlla ANTHROPIC_API_KEY nel file .env."
                break
            except anthropic.RateLimitError:
                risposta = "⚠️ Troppe richieste in poco tempo: riprova tra un minuto."
                break
            except anthropic.APIConnectionError:
                risposta = "⚠️ Non riesco a raggiungere Claude: controlla la connessione internet."
                break
            except anthropic.APIStatusError as e:
                risposta = f"⚠️ Errore dal servizio Claude ({e.status_code}): {e.message}"
                break

            db.aggiungi_spesa(_costo(r))

            if r.stop_reason == "refusal":
                risposta = "Non posso aiutarti con questa richiesta. Prova a riformularla."
                break

            if r.content:
                # i blocchi tornano all'API esattamente come sono arrivati (cronologia solo in aggiunta)
                messaggi.append({"role": "assistant", "content": [b.to_dict() for b in r.content]})
                _salva(conversazione_id, messaggi)

            testi = [b.text for b in r.content if b.type == "text"]
            if testi:
                risposta = "\n\n".join(testi)

            if r.stop_reason == "pause_turn":
                continue
            if r.stop_reason != "tool_use":
                if r.stop_reason == "max_tokens":
                    risposta += "\n\n_(risposta interrotta perché troppo lunga)_"
                break

            risultati = []
            for blocco in r.content:
                if blocco.type != "tool_use":
                    continue
                esito, errore = tools.esegui(blocco.name, dict(blocco.input or {}), conversazione_id)
                azioni.append({"strumento": blocco.name, "input": blocco.input, "errore": errore,
                               "in_coda": esito.startswith("Azione NON eseguita")})
                risultati.append({"type": "tool_result", "tool_use_id": blocco.id,
                                  "content": esito[:50000], "is_error": errore})
            messaggi.append({"role": "user", "content": risultati})
            _salva(conversazione_id, messaggi)
        else:
            risposta += "\n\n_(mi sono fermato: troppi passaggi per una sola richiesta)_"

    return {"conversazione_id": conversazione_id, "risposta": risposta.strip(), "azioni": azioni}


def messaggi_leggibili(conversazione_id: int) -> list[dict]:
    """Converte la cronologia per mostrarla nella dashboard."""
    conv = db.riga("SELECT messaggi FROM conversazioni WHERE id=?", (conversazione_id,))
    out: list[dict] = []
    for m in json.loads(conv["messaggi"]) if conv else []:
        contenuto = m["content"]
        if m["role"] == "user":
            if isinstance(contenuto, str):
                testo = contenuto.split("]\n", 1)[1] if contenuto.startswith("[") and "]\n" in contenuto else contenuto
                out.append({"ruolo": "utente", "testo": testo})
            continue
        for b in contenuto:
            if b.get("type") == "text" and b.get("text", "").strip():
                out.append({"ruolo": "jarvis", "testo": b["text"]})
            elif b.get("type") in ("tool_use", "server_tool_use"):
                out.append({"ruolo": "azione", "testo": b.get("name", "")})
    return out
