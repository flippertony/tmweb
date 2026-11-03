"""Configurazione: legge .env e config/siti.yaml."""
from __future__ import annotations

import os
from pathlib import Path

import yaml
from dotenv import load_dotenv

RADICE = Path(__file__).resolve().parent.parent
CARTELLA_CONFIG = RADICE / "config"
CARTELLA_MEMORIA = RADICE / "memoria"
CARTELLA_DATI = RADICE / "dati"
CARTELLA_DATI.mkdir(exist_ok=True)

load_dotenv(RADICE / ".env")

MODELLO = os.getenv("JARVIS_MODELLO", "claude-opus-5-5")
EFFORT_CHAT = os.getenv("JARVIS_EFFORT_CHAT", "medium")
AUTONOMIA = int(os.getenv("JARVIS_AUTONOMIA", "2"))
BUDGET_GIORNALIERO_USD = float(os.getenv("JARVIS_BUDGET_GIORNALIERO_USD", "5"))
PORTA = int(os.getenv("JARVIS_PORTA", "8765"))

DB_PATH = CARTELLA_DATI / "jarvis.db"
GOOGLE_CREDENZIALI = CARTELLA_CONFIG / "google_credentials.json"
GOOGLE_TOKEN = CARTELLA_CONFIG / "google_token.json"
FILE_SITI = CARTELLA_CONFIG / "siti.yaml"
FILE_AUTOMAZIONI = CARTELLA_CONFIG / "automazioni.yaml"

# Prezzi per milione di token (USD) usati per stimare la spesa.
PREZZI = {
    "claude-opus-5-5": {"input": 4.0, "output": 20.0, "cache_read": 0.20, "cache_write": 5.0},
    "claude-sonnet-5-5": {"input": 2.0, "output": 10.0, "cache_read": 0.20, "cache_write": 2.5},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50, "cache_read": 0.01, "cache_write": 0.125},
}


def carica_yaml(percorso: Path) -> dict:
    if not percorso.exists():
        return {}
    with open(percorso, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def siti() -> dict:
    """Siti dei clienti (WordPress, PrestaShop, monitoraggio), letti a ogni chiamata
    così le modifiche al file valgono senza riavviare."""
    return carica_yaml(FILE_SITI)


def automazioni() -> list[dict]:
    return carica_yaml(FILE_AUTOMAZIONI).get("automazioni", [])
