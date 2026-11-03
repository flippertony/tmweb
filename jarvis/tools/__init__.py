"""Registro degli strumenti di Jarvis e controllo dell'autonomia.

Ogni strumento dichiara un livello di rischio:
  lettura      -> legge e basta: sempre automatico
  reversibile  -> modifica dati locali/bozze (CRM, memoria, bozze email)
  esterna      -> modifica sistemi esterni senza renderli pubblici (bozze WordPress)
  critica      -> azioni visibili a terzi o irreversibili (inviare email, pubblicare):
                  chiedono SEMPRE approvazione

JARVIS_AUTONOMIA decide cosa parte da solo: 1 = solo lettura, 2 = + reversibile,
3 = + esterna. Quello che non può partire finisce nella coda delle approvazioni.
"""
from __future__ import annotations

import json
import traceback
from dataclasses import dataclass
from typing import Callable

from .. import config, db

LIVELLI = {"lettura": 0, "reversibile": 1, "esterna": 2, "critica": 3}


@dataclass
class Strumento:
    nome: str
    descrizione: str
    parametri: dict
    rischio: str
    funzione: Callable[..., str]

    def definizione(self) -> dict:
        return {"name": self.nome, "description": self.descrizione, "input_schema": self.parametri}


STRUMENTI: dict[str, Strumento] = {}


def strumento(nome: str, descrizione: str, rischio: str, proprieta: dict | None = None,
              obbligatori: list[str] | None = None):
    """Decoratore per registrare una funzione come strumento di Jarvis."""
    assert rischio in LIVELLI, rischio

    def registra(funzione: Callable[..., str]):
        STRUMENTI[nome] = Strumento(
            nome=nome,
            descrizione=descrizione,
            parametri={"type": "object", "properties": proprieta or {},
                       "required": obbligatori or []},
            rischio=rischio,
            funzione=funzione,
        )
        return funzione

    return registra


def puo_agire_da_solo(s: Strumento) -> bool:
    if s.rischio == "lettura":
        return True
    if s.rischio == "critica" or db.in_pausa():
        return False
    return LIVELLI[s.rischio] <= config.AUTONOMIA


def esegui_diretto(nome: str, input_: dict, conversazione_id: int | None = None) -> tuple[str, bool]:
    """Esegue lo strumento senza controlli di autonomia (usato dopo l'approvazione)."""
    s = STRUMENTI.get(nome)
    if s is None:
        return f"Strumento sconosciuto: {nome}", True
    try:
        esito = s.funzione(**input_)
        errore = False
    except TypeError as e:
        esito, errore = f"Parametri non validi per {nome}: {e}", True
    except (ValueError, RuntimeError) as e:  # errori previsti (configurazione mancante ecc.)
        esito, errore = f"Errore in {nome}: {e}", True
    except Exception as e:  # l'errore torna a Claude, che può correggersi
        esito, errore = f"Errore in {nome}: {e}", True
        traceback.print_exc()
    if not isinstance(esito, str):
        esito = json.dumps(esito, ensure_ascii=False, default=str)
    db.registra(nome, input_, esito, errore, conversazione_id)
    return esito, errore


def esegui(nome: str, input_: dict, conversazione_id: int | None = None) -> tuple[str, bool]:
    """Esegue lo strumento se il livello di autonomia lo consente, altrimenti lo mette in coda."""
    s = STRUMENTI.get(nome)
    if s is None:
        return f"Strumento sconosciuto: {nome}", True
    if puo_agire_da_solo(s):
        return esegui_diretto(nome, input_, conversazione_id)

    motivo = "pausa di emergenza attiva" if db.in_pausa() else f"azione di tipo '{s.rischio}'"
    id_ = db.esegui(
        "INSERT INTO approvazioni(strumento, input, motivo, conversazione_id, creata_il) "
        "VALUES(?,?,?,?,?)",
        (nome, json.dumps(input_, ensure_ascii=False), motivo, conversazione_id, db.ora()),
    )
    db.notifica(f"Approvazione richiesta #{id_}", f"{nome}: {motivo}", "approvazione")
    return (f"Azione NON eseguita: messa in coda per l'approvazione dell'utente (richiesta #{id_}, "
            f"{motivo}). Dillo all'utente e non riprovare la stessa azione."), False


def approva(id_: int) -> str:
    a = db.riga("SELECT * FROM approvazioni WHERE id=?", (id_,))
    if not a or a["stato"] != "in_attesa":
        return "Richiesta non trovata o già decisa."
    esito, errore = esegui_diretto(a["strumento"], json.loads(a["input"]), a["conversazione_id"])
    db.esegui("UPDATE approvazioni SET stato='approvata', esito=?, decisa_il=? WHERE id=?",
              (esito[:4000], db.ora(), id_))
    return ("ERRORE: " if errore else "") + esito


def rifiuta(id_: int) -> None:
    db.esegui("UPDATE approvazioni SET stato='rifiutata', decisa_il=? WHERE id=? AND stato='in_attesa'",
              (db.ora(), id_))


def definizioni() -> list[dict]:
    return [s.definizione() for s in STRUMENTI.values()]


def carica_tutti() -> None:
    """Importa i moduli: ogni import registra i propri strumenti."""
    from . import memoria, crm, siti, gmail, drive, wordpress, prestashop, sistema  # noqa: F401
