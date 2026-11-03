"""Strumenti su Jarvis stesso: registro delle azioni (per auto-migliorarsi) e notifiche."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from .. import db
from . import strumento


@strumento("jarvis_registro",
           "Le azioni che hai eseguito negli ultimi N giorni, gli errori e le decisioni dell'utente sulle "
           "approvazioni (le richieste rifiutate indicano cosa migliorare).",
           "lettura", {"giorni": {"type": "integer", "description": "default 7"}})
def jarvis_registro(giorni: int = 7) -> str:
    dal = (datetime.now() - timedelta(days=giorni)).isoformat(timespec="seconds")
    azioni = db.righe("SELECT strumento, COUNT(*) AS volte, SUM(errore) AS errori FROM registro "
                      "WHERE quando >= ? GROUP BY strumento ORDER BY volte DESC", (dal,))
    errori = db.righe("SELECT quando, strumento, input, esito FROM registro WHERE errore=1 AND quando >= ? "
                      "ORDER BY id DESC LIMIT 20", (dal,))
    decisioni = db.righe("SELECT strumento, input, stato, creata_il FROM approvazioni WHERE creata_il >= ? "
                         "ORDER BY id DESC LIMIT 40", (dal,))
    return json.dumps({"azioni": azioni, "errori_recenti": errori, "approvazioni": decisioni},
                      ensure_ascii=False)


@strumento("jarvis_notifica", "Mostra una notifica all'utente nella dashboard (es. un avviso importante).",
           "lettura",  # innocuo: avvisa soltanto l'utente
           {"titolo": {"type": "string"}, "testo": {"type": "string"},
            "livello": {"type": "string", "enum": ["info", "avviso", "allarme"]}},
           ["titolo"])
def jarvis_notifica(titolo: str, testo: str = "", livello: str = "info") -> str:
    db.notifica(titolo, testo, livello)
    return "Notifica inviata."
