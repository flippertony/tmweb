"""WordPress (REST API con "Password applicazione"): articoli, pagine, bozze, pubblicazione."""
from __future__ import annotations

import json
import re

import httpx

from .. import config
from . import strumento


def _sito(nome: str) -> dict:
    s = (config.siti().get("siti") or {}).get(nome)
    if not s or not s.get("wordpress"):
        disponibili = [n for n, d in (config.siti().get("siti") or {}).items() if d.get("wordpress")]
        raise ValueError(f"Sito WordPress '{nome}' non configurato. Disponibili: {disponibili}")
    return s


def _client(nome: str) -> httpx.Client:
    s = _sito(nome)
    wp = s["wordpress"]
    return httpx.Client(base_url=s["url"].rstrip("/") + "/wp-json/wp/v2/",
                        auth=(wp["utente"], wp["password_applicazione"]), timeout=30)


def _pulisci(html: str, max_car: int = 400) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()[:max_car]


@strumento("wp_siti", "Elenca i siti WordPress configurati.", "lettura")
def wp_siti() -> str:
    return json.dumps([{"nome": n, "url": d.get("url"), "cliente": d.get("cliente")}
                       for n, d in (config.siti().get("siti") or {}).items() if d.get("wordpress")],
                      ensure_ascii=False)


@strumento("wp_contenuti", "Elenca articoli o pagine di un sito WordPress (anche bozze).", "lettura",
           {"sito": {"type": "string"},
            "tipo": {"type": "string", "enum": ["posts", "pages"], "description": "default posts"},
            "cerca": {"type": "string"},
            "stato": {"type": "string", "enum": ["publish", "draft", "pending", "any"], "description": "default any"}},
           ["sito"])
def wp_contenuti(sito: str, tipo: str = "posts", cerca: str = "", stato: str = "any") -> str:
    params = {"per_page": 20, "status": stato, "context": "edit"}
    if cerca:
        params["search"] = cerca
    with _client(sito) as c:
        r = c.get(tipo, params=params)
        r.raise_for_status()
    return json.dumps([{"id": p["id"], "titolo": _pulisci(p["title"].get("raw") or p["title"].get("rendered"), 200),
                        "stato": p["status"], "data": p["date"], "link": p["link"],
                        "estratto": _pulisci(p.get("excerpt", {}).get("rendered", ""), 200)}
                       for p in r.json()], ensure_ascii=False)


@strumento("wp_leggi", "Legge il contenuto completo di un articolo o pagina.", "lettura",
           {"sito": {"type": "string"}, "id": {"type": "integer"},
            "tipo": {"type": "string", "enum": ["posts", "pages"]}}, ["sito", "id"])
def wp_leggi(sito: str, id: int, tipo: str = "posts") -> str:
    with _client(sito) as c:
        r = c.get(f"{tipo}/{id}", params={"context": "edit"})
        r.raise_for_status()
    p = r.json()
    return json.dumps({"titolo": p["title"].get("raw"), "stato": p["status"], "link": p["link"],
                       "contenuto_html": p["content"].get("raw", "")[:30000]}, ensure_ascii=False)


@strumento("wp_crea_bozza",
           "Crea un articolo o pagina in BOZZA sul sito WordPress (non visibile al pubblico).",
           "esterna",
           {"sito": {"type": "string"}, "titolo": {"type": "string"},
            "contenuto_html": {"type": "string", "description": "HTML con blocchi semplici: h2, p, ul, strong"},
            "estratto": {"type": "string"},
            "tipo": {"type": "string", "enum": ["posts", "pages"], "description": "default posts"}},
           ["sito", "titolo", "contenuto_html"])
def wp_crea_bozza(sito: str, titolo: str, contenuto_html: str, estratto: str = "", tipo: str = "posts") -> str:
    with _client(sito) as c:
        r = c.post(tipo, json={"title": titolo, "content": contenuto_html, "excerpt": estratto,
                               "status": "draft"})
        r.raise_for_status()
    p = r.json()
    return f"Bozza creata (id {p['id']}). Anteprima: {p['link']}"


@strumento("wp_aggiorna", "Modifica titolo o contenuto di un articolo/pagina esistente.", "esterna",
           {"sito": {"type": "string"}, "id": {"type": "integer"},
            "titolo": {"type": "string"}, "contenuto_html": {"type": "string"},
            "tipo": {"type": "string", "enum": ["posts", "pages"]}}, ["sito", "id"])
def wp_aggiorna(sito: str, id: int, titolo: str | None = None, contenuto_html: str | None = None,
                tipo: str = "posts") -> str:
    dati = {k: v for k, v in {"title": titolo, "content": contenuto_html}.items() if v is not None}
    with _client(sito) as c:
        r = c.post(f"{tipo}/{id}", json=dati)
        r.raise_for_status()
    return "Contenuto aggiornato (WordPress conserva le revisioni precedenti)."


@strumento("wp_pubblica", "PUBBLICA un articolo/pagina in bozza. Richiede sempre l'approvazione.", "critica",
           {"sito": {"type": "string"}, "id": {"type": "integer"},
            "tipo": {"type": "string", "enum": ["posts", "pages"]}}, ["sito", "id"])
def wp_pubblica(sito: str, id: int, tipo: str = "posts") -> str:
    with _client(sito) as c:
        r = c.post(f"{tipo}/{id}", json={"status": "publish"})
        r.raise_for_status()
    return f"Pubblicato: {r.json()['link']}"
