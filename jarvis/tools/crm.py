"""CRM integrato: contatti, opportunità (pipeline) e attività."""
from __future__ import annotations

import json
from datetime import date

from .. import db
from . import strumento

FASI = ["nuovo", "contattato", "preventivo", "trattativa", "vinto", "perso"]
CAMPI_CONTATTO = ["nome", "azienda", "email", "telefono", "sito_web", "fonte", "stato", "tag", "note"]
CAMPI_OPPORTUNITA = ["titolo", "valore", "fase", "prossima_azione", "data_prossima_azione", "note"]


def _json(dati) -> str:
    return json.dumps(dati, ensure_ascii=False, indent=1, default=str)


def crea_contatto(**campi) -> int:
    campi = {k: v for k, v in campi.items() if k in CAMPI_CONTATTO and v not in (None, "")}
    campi.setdefault("stato", "lead")
    campi["creato_il"] = campi["aggiornato_il"] = db.ora()
    colonne = ", ".join(campi)
    return db.esegui(f"INSERT INTO contatti({colonne}) VALUES({', '.join('?' * len(campi))})",
                     tuple(campi.values()))


def aggiorna(tabella: str, id_: int, campi: dict, ammessi: list[str]) -> None:
    campi = {k: v for k, v in campi.items() if k in ammessi and v is not None}
    if not campi:
        return
    campi["aggiornato_il"] = db.ora()
    assegnazioni = ", ".join(f"{k}=?" for k in campi)
    db.esegui(f"UPDATE {tabella} SET {assegnazioni} WHERE id=?", (*campi.values(), id_))


def crea_opportunita(contatto_id: int, titolo: str, **campi) -> int:
    campi = {k: v for k, v in campi.items() if k in CAMPI_OPPORTUNITA and v not in (None, "")}
    campi.update(contatto_id=contatto_id, titolo=titolo, creato_il=db.ora(), aggiornato_il=db.ora())
    colonne = ", ".join(campi)
    return db.esegui(f"INSERT INTO opportunita({colonne}) VALUES({', '.join('?' * len(campi))})",
                     tuple(campi.values()))


def pipeline() -> dict:
    ops = db.righe("SELECT o.*, c.nome AS contatto, c.azienda FROM opportunita o "
                   "LEFT JOIN contatti c ON c.id = o.contatto_id ORDER BY o.aggiornato_il DESC")
    return {fase: [o for o in ops if o["fase"] == fase] for fase in FASI}


PROP_CONTATTO = {
    "nome": {"type": "string"}, "azienda": {"type": "string"}, "email": {"type": "string"},
    "telefono": {"type": "string"}, "sito_web": {"type": "string"},
    "fonte": {"type": "string", "description": "da dove arriva: modulo sito, email, passaparola..."},
    "stato": {"type": "string", "enum": ["lead", "cliente", "ex_cliente", "non_interessato"]},
    "tag": {"type": "string", "description": "parole chiave separate da virgola"},
    "note": {"type": "string"},
}


@strumento("crm_cerca", "Cerca contatti nel CRM per nome, azienda, email o tag. Vuoto = ultimi 30.",
           "lettura", {"testo": {"type": "string"}})
def crm_cerca(testo: str = "") -> str:
    q = f"%{testo}%"
    return _json(db.righe(
        "SELECT * FROM contatti WHERE nome LIKE ? OR azienda LIKE ? OR email LIKE ? OR tag LIKE ? "
        "ORDER BY aggiornato_il DESC LIMIT 30", (q, q, q, q)))


@strumento("crm_scheda", "Scheda completa di un contatto: dati, opportunità e storico attività.",
           "lettura", {"contatto_id": {"type": "integer"}}, ["contatto_id"])
def crm_scheda(contatto_id: int) -> str:
    return _json({
        "contatto": db.riga("SELECT * FROM contatti WHERE id=?", (contatto_id,)),
        "opportunita": db.righe("SELECT * FROM opportunita WHERE contatto_id=?", (contatto_id,)),
        "attivita": db.righe("SELECT * FROM attivita WHERE contatto_id=? ORDER BY data DESC LIMIT 30",
                             (contatto_id,)),
    })


@strumento("crm_crea_contatto",
           "Aggiunge un contatto al CRM. Prima controlla con crm_cerca che non esista già (stessa email).",
           "reversibile", PROP_CONTATTO, ["nome"])
def crm_crea_contatto(**campi) -> str:
    return f"Contatto creato con id {crea_contatto(**campi)}."


@strumento("crm_aggiorna_contatto", "Aggiorna i campi di un contatto esistente.", "reversibile",
           {"contatto_id": {"type": "integer"}, **PROP_CONTATTO}, ["contatto_id"])
def crm_aggiorna_contatto(contatto_id: int, **campi) -> str:
    aggiorna("contatti", contatto_id, campi, CAMPI_CONTATTO)
    return "Contatto aggiornato."


@strumento("crm_registra_attivita", "Registra nello storico di un contatto un'email, telefonata, incontro o nota.",
           "reversibile",
           {"contatto_id": {"type": "integer"},
            "tipo": {"type": "string", "enum": ["email", "telefonata", "incontro", "nota", "preventivo"]},
            "descrizione": {"type": "string"}},
           ["contatto_id", "tipo", "descrizione"])
def crm_registra_attivita(contatto_id: int, tipo: str, descrizione: str) -> str:
    db.esegui("INSERT INTO attivita(contatto_id, tipo, descrizione, data) VALUES(?,?,?,?)",
              (contatto_id, tipo, descrizione, db.ora()))
    return "Attività registrata."


PROP_OPPORTUNITA = {
    "titolo": {"type": "string", "description": "es. 'Sito e-commerce PrestaShop'"},
    "valore": {"type": "number", "description": "valore stimato in euro"},
    "fase": {"type": "string", "enum": FASI},
    "prossima_azione": {"type": "string"},
    "data_prossima_azione": {"type": "string", "description": "AAAA-MM-GG"},
    "note": {"type": "string"},
}


@strumento("crm_crea_opportunita", "Crea un'opportunità di vendita collegata a un contatto.", "reversibile",
           {"contatto_id": {"type": "integer"}, **PROP_OPPORTUNITA}, ["contatto_id", "titolo"])
def crm_crea_opportunita(contatto_id: int, titolo: str, **campi) -> str:
    return f"Opportunità creata con id {crea_opportunita(contatto_id, titolo, **campi)}."


@strumento("crm_aggiorna_opportunita", "Aggiorna fase, valore o prossima azione di un'opportunità.",
           "reversibile", {"opportunita_id": {"type": "integer"}, **PROP_OPPORTUNITA}, ["opportunita_id"])
def crm_aggiorna_opportunita(opportunita_id: int, **campi) -> str:
    aggiorna("opportunita", opportunita_id, campi, CAMPI_OPPORTUNITA)
    return "Opportunità aggiornata."


@strumento("crm_pipeline", "Riepilogo della pipeline di vendita per fase, con valori totali.", "lettura")
def crm_pipeline() -> str:
    p = pipeline()
    return _json({fase: {"numero": len(ops), "valore_totale": sum(o["valore"] or 0 for o in ops),
                         "opportunita": [{k: o[k] for k in ("id", "titolo", "contatto", "valore",
                                                            "prossima_azione", "data_prossima_azione")}
                                         for o in ops[:15]]}
                  for fase, ops in p.items()})


@strumento("crm_follow_up", "Opportunità aperte con la prossima azione scaduta o in scadenza entro N giorni.",
           "lettura", {"giorni": {"type": "integer", "description": "default 2"}})
def crm_follow_up(giorni: int = 2) -> str:
    limite = date.fromordinal(date.today().toordinal() + giorni).isoformat()
    return _json(db.righe(
        "SELECT o.*, c.nome AS contatto, c.email FROM opportunita o LEFT JOIN contatti c ON c.id=o.contatto_id "
        "WHERE o.fase NOT IN ('vinto','perso') AND (o.data_prossima_azione IS NULL "
        "OR o.data_prossima_azione <= ?) ORDER BY o.data_prossima_azione", (limite,)))
