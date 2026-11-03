"""Database locale SQLite: CRM, conversazioni, approvazioni, registro, spesa."""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, date

from .config import DB_PATH

_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS contatti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    azienda TEXT, email TEXT, telefono TEXT, sito_web TEXT,
    fonte TEXT,                      -- es. modulo sito, passaparola, email
    stato TEXT DEFAULT 'lead',       -- lead | cliente | ex_cliente | non_interessato
    tag TEXT, note TEXT,
    creato_il TEXT, aggiornato_il TEXT
);
CREATE TABLE IF NOT EXISTS opportunita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contatto_id INTEGER REFERENCES contatti(id),
    titolo TEXT NOT NULL,
    valore REAL DEFAULT 0,
    fase TEXT DEFAULT 'nuovo',       -- nuovo | contattato | preventivo | trattativa | vinto | perso
    prossima_azione TEXT, data_prossima_azione TEXT,
    note TEXT, creato_il TEXT, aggiornato_il TEXT
);
CREATE TABLE IF NOT EXISTS attivita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contatto_id INTEGER REFERENCES contatti(id),
    tipo TEXT,                       -- email | telefonata | incontro | nota | preventivo
    descrizione TEXT, data TEXT
);
CREATE TABLE IF NOT EXISTS conversazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT, origine TEXT DEFAULT 'chat',   -- chat | automazione:<nome>
    system TEXT, messaggi TEXT DEFAULT '[]',
    creata_il TEXT, aggiornata_il TEXT
);
CREATE TABLE IF NOT EXISTS approvazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strumento TEXT, input TEXT, motivo TEXT,
    conversazione_id INTEGER,
    stato TEXT DEFAULT 'in_attesa',  -- in_attesa | approvata | rifiutata
    esito TEXT, creata_il TEXT, decisa_il TEXT
);
CREATE TABLE IF NOT EXISTS registro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quando TEXT, strumento TEXT, input TEXT, esito TEXT,
    errore INTEGER DEFAULT 0, conversazione_id INTEGER
);
CREATE TABLE IF NOT EXISTS notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quando TEXT, livello TEXT, titolo TEXT, testo TEXT, letta INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS spesa (
    giorno TEXT PRIMARY KEY, usd REAL DEFAULT 0, richieste INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS controlli_siti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sito TEXT, url TEXT, quando TEXT, online INTEGER, codice INTEGER,
    tempo_ms INTEGER, ssl_giorni INTEGER, errore TEXT
);
CREATE TABLE IF NOT EXISTS impostazioni (chiave TEXT PRIMARY KEY, valore TEXT);
"""


def ora() -> str:
    return datetime.now().isoformat(timespec="seconds")


@contextmanager
def connessione():
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def inizializza() -> None:
    with connessione() as c:
        c.executescript(SCHEMA)


def righe(sql: str, params: tuple = ()) -> list[dict]:
    with connessione() as c:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def riga(sql: str, params: tuple = ()) -> dict | None:
    r = righe(sql, params)
    return r[0] if r else None


def esegui(sql: str, params: tuple = ()) -> int:
    """Esegue una scrittura e restituisce l'id della riga inserita."""
    with connessione() as c:
        return c.execute(sql, params).lastrowid


# --- Impostazioni (pausa di emergenza) ---------------------------------------

def impostazione(chiave: str, default: str = "") -> str:
    r = riga("SELECT valore FROM impostazioni WHERE chiave=?", (chiave,))
    return r["valore"] if r else default


def imposta(chiave: str, valore: str) -> None:
    esegui("INSERT INTO impostazioni(chiave, valore) VALUES(?, ?) "
           "ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore", (chiave, valore))


def in_pausa() -> bool:
    return impostazione("pausa", "0") == "1"


# --- Notifiche, registro, spesa -----------------------------------------------

def notifica(titolo: str, testo: str = "", livello: str = "info") -> None:
    esegui("INSERT INTO notifiche(quando, livello, titolo, testo) VALUES(?,?,?,?)",
           (ora(), livello, titolo, testo))


def registra(strumento: str, input_: dict, esito: str, errore: bool, conversazione_id: int | None) -> None:
    esegui("INSERT INTO registro(quando, strumento, input, esito, errore, conversazione_id) "
           "VALUES(?,?,?,?,?,?)",
           (ora(), strumento, json.dumps(input_, ensure_ascii=False), esito[:4000],
            int(errore), conversazione_id))


def aggiungi_spesa(usd: float) -> None:
    esegui("INSERT INTO spesa(giorno, usd, richieste) VALUES(?, ?, 1) "
           "ON CONFLICT(giorno) DO UPDATE SET usd = usd + excluded.usd, richieste = richieste + 1",
           (date.today().isoformat(), usd))


def spesa_oggi() -> float:
    r = riga("SELECT usd FROM spesa WHERE giorno=?", (date.today().isoformat(),))
    return r["usd"] if r else 0.0
