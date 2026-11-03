"""Sorveglianza dei siti dei clienti: online, velocità, scadenza certificato SSL."""
from __future__ import annotations

import json
import socket
import ssl
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from .. import config, db
from . import strumento

SOGLIA_SSL_GIORNI = 14
SOGLIA_LENTEZZA_MS = 3000


def _giorni_ssl(host: str) -> int | None:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as s:
            scadenza = datetime.strptime(s.getpeercert()["notAfter"], "%b %d %H:%M:%S %Y %Z")
    return (scadenza.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days


def elenco_siti() -> list[dict]:
    """Tutti i siti di config/siti.yaml che hanno un url."""
    return [{"nome": nome, **dati} for nome, dati in (config.siti().get("siti") or {}).items()
            if isinstance(dati, dict) and dati.get("url")]


def controlla_sito(nome: str, url: str) -> dict:
    esito = {"sito": nome, "url": url, "online": 0, "codice": None, "tempo_ms": None,
             "ssl_giorni": None, "errore": None}
    try:
        inizio = time.monotonic()
        r = httpx.get(url, timeout=20, follow_redirects=True,
                      headers={"User-Agent": "Jarvis-Monitor/1.0"})
        esito["tempo_ms"] = int((time.monotonic() - inizio) * 1000)
        esito["codice"] = r.status_code
        esito["online"] = int(r.status_code < 400)
        host = urlparse(str(r.url)).hostname
        if str(r.url).startswith("https") and host:
            esito["ssl_giorni"] = _giorni_ssl(host)
    except Exception as e:
        esito["errore"] = str(e)[:300]
    return esito


def controlla_tutti(notifica: bool = True) -> list[dict]:
    risultati = []
    for s in elenco_siti():
        precedente = db.riga("SELECT online FROM controlli_siti WHERE sito=? ORDER BY id DESC LIMIT 1",
                             (s["nome"],))
        e = controlla_sito(s["nome"], s["url"])
        db.esegui("INSERT INTO controlli_siti(sito, url, quando, online, codice, tempo_ms, ssl_giorni, errore) "
                  "VALUES(?,?,?,?,?,?,?,?)",
                  (e["sito"], e["url"], db.ora(), e["online"], e["codice"], e["tempo_ms"],
                   e["ssl_giorni"], e["errore"]))
        if notifica:
            # avvisa solo quando lo stato cambia, per non riempire le notifiche
            if not e["online"] and (precedente is None or precedente["online"]):
                db.notifica(f"🔴 {s['nome']} non raggiungibile", e["errore"] or f"HTTP {e['codice']}", "allarme")
            elif e["online"] and precedente is not None and not precedente["online"]:
                db.notifica(f"🟢 {s['nome']} di nuovo online", "", "info")
            if e["ssl_giorni"] is not None and e["ssl_giorni"] <= SOGLIA_SSL_GIORNI and \
                    datetime.now().hour == 9 and datetime.now().minute < 30:
                db.notifica(f"🔒 SSL di {s['nome']} scade tra {e['ssl_giorni']} giorni", s["url"], "avviso")
        risultati.append(e)
    return risultati


def ultimo_stato() -> list[dict]:
    """Ultimo controllo di ogni sito ancora presente in config/siti.yaml."""
    configurati = {s["nome"] for s in elenco_siti()}
    return [r for r in db.righe("SELECT c.* FROM controlli_siti c JOIN (SELECT sito, MAX(id) AS m "
                                "FROM controlli_siti GROUP BY sito) u ON c.id = u.m ORDER BY c.sito")
            if r["sito"] in configurati]


def _con_problemi(stato: list[dict]) -> list[dict]:
    for s in stato:
        problemi = []
        if not s["online"]:
            problemi.append("non raggiungibile")
        if s["tempo_ms"] and s["tempo_ms"] > SOGLIA_LENTEZZA_MS:
            problemi.append("lento")
        if s["ssl_giorni"] is not None and s["ssl_giorni"] <= SOGLIA_SSL_GIORNI:
            problemi.append("SSL in scadenza")
        s["problemi"] = problemi
    return stato


@strumento("siti_stato", "Ultimo stato noto dei siti dei clienti (online, tempo di risposta, giorni a "
           "scadenza SSL, problemi).", "lettura")
def siti_stato() -> str:
    stato = ultimo_stato()
    if not stato:
        return "Nessun controllo ancora eseguito (o nessun sito in config/siti.yaml)."
    return json.dumps(_con_problemi(stato), ensure_ascii=False)


@strumento("siti_controlla_ora", "Controlla subito tutti i siti dei clienti e restituisce il risultato.",
           "lettura")
def siti_controlla_ora() -> str:
    controlla_tutti(notifica=False)
    return siti_stato()
