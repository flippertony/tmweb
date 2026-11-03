"""Gmail: cercare, leggere, preparare bozze e (con approvazione) inviare."""
from __future__ import annotations

import base64
import json
import re
from email.message import EmailMessage
from html import unescape

from ..google_auth import servizio
from . import strumento


def _gmail():
    return servizio("gmail", "v1")


def _intestazione(msg: dict, nome: str) -> str:
    for h in msg.get("payload", {}).get("headers", []):
        if h["name"].lower() == nome.lower():
            return h["value"]
    return ""


def _testo(parte: dict) -> str:
    """Estrae il testo leggibile da un messaggio (preferisce text/plain)."""
    mime = parte.get("mimeType", "")
    dati = parte.get("body", {}).get("data")
    if mime == "text/plain" and dati:
        return base64.urlsafe_b64decode(dati).decode("utf-8", "replace")
    sottoparti = parte.get("parts", [])
    for p in sottoparti:
        if p.get("mimeType") == "text/plain":
            t = _testo(p)
            if t:
                return t
    for p in sottoparti:
        t = _testo(p)
        if t:
            return t
    if mime == "text/html" and dati:
        html = base64.urlsafe_b64decode(dati).decode("utf-8", "replace")
        return unescape(re.sub(r"<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", "", html)))
    return ""


def _componi(a: str, oggetto: str, testo: str, thread_id: str | None, cc: str | None) -> dict:
    m = EmailMessage()
    m["To"] = a
    m["Subject"] = oggetto
    if cc:
        m["Cc"] = cc
    if thread_id:  # risposta nello stesso thread
        ultimo = _gmail().users().threads().get(userId="me", id=thread_id, format="metadata",
                                                metadataHeaders=["Message-ID"]).execute()["messages"][-1]
        mid = _intestazione(ultimo, "Message-ID")
        if mid:
            m["In-Reply-To"] = m["References"] = mid
    m.set_content(testo)
    corpo = {"raw": base64.urlsafe_b64encode(m.as_bytes()).decode()}
    if thread_id:
        corpo["threadId"] = thread_id
    return corpo


@strumento("gmail_cerca",
           "Cerca email con la sintassi di Gmail (es. 'is:unread newer_than:1d', 'from:cliente@x.it', "
           "'subject:preventivo'). Restituisce id, thread, mittente, oggetto, data, anteprima.",
           "lettura",
           {"query": {"type": "string"}, "max_risultati": {"type": "integer", "description": "default 15"}},
           ["query"])
def gmail_cerca(query: str, max_risultati: int = 15) -> str:
    g = _gmail().users().messages()
    ids = g.list(userId="me", q=query, maxResults=min(max_risultati, 50)).execute().get("messages", [])
    out = []
    for i in ids:
        m = g.get(userId="me", id=i["id"], format="metadata",
                  metadataHeaders=["From", "To", "Subject", "Date"]).execute()
        out.append({"id": m["id"], "thread_id": m["threadId"], "da": _intestazione(m, "From"),
                    "a": _intestazione(m, "To"), "oggetto": _intestazione(m, "Subject"),
                    "data": _intestazione(m, "Date"), "anteprima": unescape(m.get("snippet", "")),
                    "non_letta": "UNREAD" in m.get("labelIds", [])})
    return json.dumps(out, ensure_ascii=False) if out else "Nessuna email trovata."


@strumento("gmail_leggi", "Legge il testo completo di un'email dato il suo id.", "lettura",
           {"id": {"type": "string"}}, ["id"])
def gmail_leggi(id: str) -> str:
    m = _gmail().users().messages().get(userId="me", id=id, format="full").execute()
    testo = _testo(m["payload"]).strip()
    return json.dumps({"da": _intestazione(m, "From"), "a": _intestazione(m, "To"),
                       "oggetto": _intestazione(m, "Subject"), "data": _intestazione(m, "Date"),
                       "thread_id": m["threadId"], "testo": testo[:15000]}, ensure_ascii=False)


@strumento("gmail_segna_letta", "Segna un'email come letta.", "reversibile", {"id": {"type": "string"}}, ["id"])
def gmail_segna_letta(id: str) -> str:
    _gmail().users().messages().modify(userId="me", id=id, body={"removeLabelIds": ["UNREAD"]}).execute()
    return "Segnata come letta."


@strumento("gmail_etichetta",
           "Aggiunge un'etichetta a un'email (la crea se non esiste). Usa 'Jarvis-elaborata' per segnare "
           "le email già gestite, così non le rielabori.",
           "reversibile", {"id": {"type": "string"}, "etichetta": {"type": "string"}}, ["id", "etichetta"])
def gmail_etichetta(id: str, etichetta: str) -> str:
    etichette = _gmail().users().labels()
    esistenti = {l["name"]: l["id"] for l in etichette.list(userId="me").execute().get("labels", [])}
    label_id = esistenti.get(etichetta) or etichette.create(
        userId="me", body={"name": etichetta, "labelListVisibility": "labelShow",
                           "messageListVisibility": "show"}).execute()["id"]
    _gmail().users().messages().modify(userId="me", id=id, body={"addLabelIds": [label_id]}).execute()
    return f"Etichetta '{etichetta}' aggiunta."


PROP_EMAIL = {
    "a": {"type": "string", "description": "destinatario/i"},
    "oggetto": {"type": "string"},
    "testo": {"type": "string", "description": "corpo dell'email in testo semplice"},
    "thread_id": {"type": "string", "description": "per rispondere in un thread esistente"},
    "cc": {"type": "string"},
}


@strumento("gmail_crea_bozza",
           "Crea una BOZZA in Gmail (non la invia): l'utente la trova tra le bozze, pronta da rivedere.",
           "reversibile", PROP_EMAIL, ["a", "oggetto", "testo"])
def gmail_crea_bozza(a: str, oggetto: str, testo: str, thread_id: str | None = None, cc: str | None = None) -> str:
    bozza = _gmail().users().drafts().create(
        userId="me", body={"message": _componi(a, oggetto, testo, thread_id, cc)}).execute()
    return f"Bozza creata (id {bozza['id']})."


@strumento("gmail_invia", "INVIA un'email. Richiede sempre l'approvazione dell'utente.", "critica",
           PROP_EMAIL, ["a", "oggetto", "testo"])
def gmail_invia(a: str, oggetto: str, testo: str, thread_id: str | None = None, cc: str | None = None) -> str:
    inviata = _gmail().users().messages().send(
        userId="me", body=_componi(a, oggetto, testo, thread_id, cc)).execute()
    return f"Email inviata (id {inviata['id']})."
