"""Dashboard web locale di Jarvis (solo su questo PC: http://localhost:8765)."""
from __future__ import annotations

import json
import os
import threading
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import brain, config, db, google_auth, scheduler, tools
from .tools import crm, siti

STATICI = Path(__file__).parent / "static"
app = FastAPI(title="Jarvis")
app.mount("/static", StaticFiles(directory=STATICI), name="static")


@app.get("/")
def home():
    return FileResponse(STATICI / "index.html")


# --- Stato generale -------------------------------------------------------------

@app.get("/api/stato")
def stato():
    return {
        "modello": config.MODELLO,
        "autonomia": config.AUTONOMIA,
        "chiave_api": bool(os.getenv("ANTHROPIC_API_KEY")),
        "google": google_auth.collegato(),
        "siti": len(siti.elenco_siti()),
        "pausa": db.in_pausa(),
        "spesa_oggi": round(db.spesa_oggi(), 3),
        "budget": config.BUDGET_GIORNALIERO_USD,
        "approvazioni_in_attesa": db.riga("SELECT COUNT(*) n FROM approvazioni WHERE stato='in_attesa'")["n"],
        "notifiche_non_lette": db.riga("SELECT COUNT(*) n FROM notifiche WHERE letta=0")["n"],
        "strumenti": len(tools.STRUMENTI),
    }


class Pausa(BaseModel):
    attiva: bool


@app.post("/api/pausa")
def pausa(p: Pausa):
    db.imposta("pausa", "1" if p.attiva else "0")
    return {"pausa": p.attiva}


# --- Chat ----------------------------------------------------------------------

class Messaggio(BaseModel):
    testo: str
    conversazione_id: int | None = None


@app.post("/api/chat")
def chat(m: Messaggio):
    if not m.testo.strip():
        raise HTTPException(400, "Messaggio vuoto")
    return brain.rispondi(m.testo.strip(), m.conversazione_id)


@app.get("/api/conversazioni")
def conversazioni():
    return db.righe("SELECT id, titolo, origine, aggiornata_il FROM conversazioni "
                    "ORDER BY aggiornata_il DESC LIMIT 60")


@app.get("/api/conversazioni/{id_}")
def conversazione(id_: int):
    return brain.messaggi_leggibili(id_)


# --- Approvazioni, registro, notifiche ---------------------------------------------

@app.get("/api/approvazioni")
def approvazioni(stato: str = "in_attesa"):
    return db.righe("SELECT * FROM approvazioni WHERE stato=? ORDER BY id DESC LIMIT 100", (stato,))


@app.post("/api/approvazioni/{id_}/approva")
def approva(id_: int):
    return {"esito": tools.approva(id_)}


@app.post("/api/approvazioni/{id_}/rifiuta")
def rifiuta(id_: int):
    tools.rifiuta(id_)
    return {"ok": True}


@app.get("/api/registro")
def registro():
    return db.righe("SELECT * FROM registro ORDER BY id DESC LIMIT 200")


@app.get("/api/notifiche")
def notifiche():
    return db.righe("SELECT * FROM notifiche ORDER BY id DESC LIMIT 100")


@app.post("/api/notifiche/lette")
def notifiche_lette():
    db.esegui("UPDATE notifiche SET letta=1 WHERE letta=0")
    return {"ok": True}


# --- CRM -----------------------------------------------------------------------

class Contatto(BaseModel):
    nome: str
    azienda: str | None = None
    email: str | None = None
    telefono: str | None = None
    sito_web: str | None = None
    fonte: str | None = None
    stato: str | None = "lead"
    tag: str | None = None
    note: str | None = None


class Opportunita(BaseModel):
    contatto_id: int | None = None
    titolo: str | None = None
    valore: float | None = None
    fase: str | None = None
    prossima_azione: str | None = None
    data_prossima_azione: str | None = None
    note: str | None = None


@app.get("/api/crm/contatti")
def contatti(cerca: str = ""):
    return json.loads(crm.crm_cerca(cerca))


@app.post("/api/crm/contatti")
def nuovo_contatto(c: Contatto):
    return {"id": crm.crea_contatto(**c.model_dump())}


@app.put("/api/crm/contatti/{id_}")
def modifica_contatto(id_: int, c: Contatto):
    crm.aggiorna("contatti", id_, c.model_dump(), crm.CAMPI_CONTATTO)
    return {"ok": True}


@app.get("/api/crm/contatti/{id_}")
def scheda(id_: int):
    return json.loads(crm.crm_scheda(id_))


@app.get("/api/crm/pipeline")
def pipeline():
    return crm.pipeline()


@app.post("/api/crm/opportunita")
def nuova_opportunita(o: Opportunita):
    if not o.contatto_id or not o.titolo:
        raise HTTPException(400, "Servono contatto e titolo")
    dati = o.model_dump(exclude={"contatto_id", "titolo"})
    return {"id": crm.crea_opportunita(o.contatto_id, o.titolo, **dati)}


@app.put("/api/crm/opportunita/{id_}")
def modifica_opportunita(id_: int, o: Opportunita):
    crm.aggiorna("opportunita", id_, o.model_dump(), crm.CAMPI_OPPORTUNITA)
    return {"ok": True}


# --- Siti e automazioni --------------------------------------------------------------

@app.get("/api/siti")
def stato_siti():
    return siti._con_problemi(siti.ultimo_stato())


@app.post("/api/siti/controlla")
def controlla_siti():
    siti.controlla_tutti(notifica=True)
    return siti._con_problemi(siti.ultimo_stato())


@app.get("/api/automazioni")
def automazioni():
    prossime = scheduler.prossime_esecuzioni()
    return [{"nome": a["nome"], "titolo": a.get("titolo", a["nome"]), "quando": a["quando"],
             "attiva": a.get("attiva", True), "prossima": prossime.get(f"auto:{a['nome']}", ""),
             "prompt": a["prompt"]} for a in config.automazioni()]


@app.post("/api/automazioni/{nome}/esegui")
def esegui_automazione(nome: str):
    return scheduler.esegui_automazione(nome, manuale=True)


def main() -> None:
    db.inizializza()
    tools.carica_tutti()
    scheduler.avvia()
    url = f"http://localhost:{config.PORTA}"
    print(f"\n  🤖 Jarvis è attivo: {url}\n  (chiudi questa finestra per spegnerlo)\n")
    if os.getenv("JARVIS_NO_BROWSER") != "1":
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    # 127.0.0.1: la dashboard è raggiungibile solo da questo PC
    uvicorn.run(app, host="127.0.0.1", port=config.PORTA, log_level="warning")


if __name__ == "__main__":
    main()
