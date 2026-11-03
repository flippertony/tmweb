"""Memoria a lungo termine: file Markdown nella cartella memoria/.

È il modo principale per "arricchire" Jarvis: puoi scrivere tu i file, oppure
dirgli di ricordare qualcosa e lo salva qui.
"""
from __future__ import annotations

from pathlib import Path

from ..config import CARTELLA_MEMORIA
from . import strumento

# File che definiscono le regole di Jarvis: li può modificare solo con approvazione.
FILE_PROTETTI = {"identita.md"}


def _percorso(file: str) -> Path:
    p = (CARTELLA_MEMORIA / file).resolve()
    if CARTELLA_MEMORIA.resolve() not in p.parents:
        raise ValueError("Percorso fuori dalla cartella memoria.")
    if p.suffix != ".md":
        raise ValueError("Solo file .md")
    return p


def elenco_file() -> list[str]:
    return sorted(str(p.relative_to(CARTELLA_MEMORIA)).replace("\\", "/")
                  for p in CARTELLA_MEMORIA.rglob("*.md"))


@strumento("memoria_elenca", "Elenca i file della memoria di Jarvis (profilo, clienti, procedure, lezioni).",
           "lettura")
def memoria_elenca() -> str:
    return "\n".join(elenco_file()) or "(memoria vuota)"


@strumento("memoria_leggi", "Legge un file della memoria, es. 'clienti/rossi.md' o 'procedure/preventivo.md'.",
           "lettura", {"file": {"type": "string"}}, ["file"])
def memoria_leggi(file: str) -> str:
    p = _percorso(file)
    return p.read_text(encoding="utf-8") if p.exists() else f"Il file {file} non esiste."


@strumento("memoria_scrivi",
           "Crea o sostituisce un file di memoria (es. scheda cliente, procedura). Usalo per ricordare "
           "informazioni durature. Per aggiungere senza sovrascrivere usa memoria_aggiungi.",
           "reversibile",
           {"file": {"type": "string", "description": "es. clienti/nome-cliente.md"},
            "contenuto": {"type": "string", "description": "Testo Markdown completo"}},
           ["file", "contenuto"])
def memoria_scrivi(file: str, contenuto: str) -> str:
    if Path(file).name in FILE_PROTETTI:
        return "Questo file contiene le tue regole: usa proponi_modifica_regole."
    p = _percorso(file)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():  # copia di sicurezza: l'azione resta reversibile
        p.with_suffix(".md.bak").write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
    p.write_text(contenuto, encoding="utf-8")
    return f"Salvato {file}."


@strumento("memoria_aggiungi",
           "Aggiunge una nota in fondo a un file di memoria (es. 'lezioni.md' per ciò che hai imparato "
           "dai feedback dell'utente).",
           "reversibile",
           {"file": {"type": "string"}, "testo": {"type": "string"}}, ["file", "testo"])
def memoria_aggiungi(file: str, testo: str) -> str:
    if Path(file).name in FILE_PROTETTI:
        return "Questo file contiene le tue regole: usa proponi_modifica_regole."
    p = _percorso(file)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a", encoding="utf-8") as f:
        f.write(("\n" if p.exists() and p.stat().st_size else "") + testo.strip() + "\n")
    return f"Aggiunto a {file}."


@strumento("proponi_modifica_regole",
           "Propone una nuova versione di identita.md (le tue regole e il tuo carattere). "
           "Richiede sempre l'approvazione dell'utente.",
           "critica",
           {"nuovo_contenuto": {"type": "string"}, "motivazione": {"type": "string"}},
           ["nuovo_contenuto", "motivazione"])
def proponi_modifica_regole(nuovo_contenuto: str, motivazione: str) -> str:
    p = _percorso("identita.md")
    p.with_suffix(".md.bak").write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
    p.write_text(nuovo_contenuto, encoding="utf-8")
    return "Regole aggiornate (copia precedente in identita.md.bak). Valgono dalla prossima conversazione."
