"""Automazioni pianificate (config/automazioni.yaml) e sorveglianza dei siti."""
from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from . import brain, config, db, google_auth
from .tools import siti

pianificatore = BackgroundScheduler(timezone="Europe/Rome",
                                    job_defaults={"coalesce": True, "max_instances": 1,
                                                  "misfire_grace_time": 3600})


def _requisito_mancante(a: dict) -> str | None:
    s = config.siti().get("siti") or {}
    for r in a.get("richiede", []) or []:
        if r == "google" and not google_auth.collegato():
            return "Google non collegato"
        if r in ("wordpress", "prestashop") and not any(d.get(r) for d in s.values() if isinstance(d, dict)):
            return f"nessun sito {r} in config/siti.yaml"
        if r == "siti" and not siti.elenco_siti():
            return "nessun sito in config/siti.yaml"
    return None


def esegui_automazione(nome: str, manuale: bool = False) -> dict:
    a = next((x for x in config.automazioni() if x.get("nome") == nome), None)
    if a is None:
        return {"errore": f"Automazione '{nome}' non trovata"}
    if db.in_pausa() and not manuale:
        return {"saltata": "pausa di emergenza attiva"}
    if db.spesa_oggi() >= config.BUDGET_GIORNALIERO_USD:
        db.notifica("💸 Budget giornaliero raggiunto", f"Automazione '{nome}' non eseguita.", "avviso")
        return {"saltata": "budget giornaliero raggiunto"}
    mancante = _requisito_mancante(a)
    if mancante:
        return {"saltata": mancante}
    if a.get("precontrollo_gmail") and not manuale:
        # controllo gratuito senza AI: se non ci sono email da guardare, Claude non viene chiamato
        from .tools.gmail import _gmail
        trovate = _gmail().users().messages().list(userId="me", q=a["precontrollo_gmail"],
                                                   maxResults=1).execute().get("messages")
        if not trovate:
            return {"saltata": "nessuna email nuova"}

    esito = brain.rispondi(a["prompt"], origine=f"automazione:{nome}", effort=a.get("effort", "medium"))
    if a.get("notifica", True) and esito["risposta"]:
        db.notifica(f"🤖 {a.get('titolo', nome)}", esito["risposta"][:3000], "automazione")
    return esito


def avvia() -> None:
    minuti = int((config.carica_yaml(config.FILE_AUTOMAZIONI).get("monitoraggio_siti_minuti")) or 30)
    pianificatore.add_job(siti.controlla_tutti, "interval", minutes=minuti, id="monitoraggio-siti")
    for a in config.automazioni():
        if a.get("attiva", True):
            pianificatore.add_job(esegui_automazione, CronTrigger.from_crontab(a["quando"], timezone="Europe/Rome"),
                                  args=[a["nome"]], id=f"auto:{a['nome']}")
    pianificatore.start()
    # primo controllo dei siti subito, in background
    pianificatore.add_job(siti.controlla_tutti, id="monitoraggio-iniziale")


def prossime_esecuzioni() -> dict[str, str]:
    return {j.id: j.next_run_time.isoformat(timespec="minutes") if j.next_run_time else ""
            for j in pianificatore.get_jobs()}
