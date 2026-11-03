"""Accesso a Gmail e Google Drive con OAuth (una sola autorizzazione per entrambi).

Prima volta: esegui `python -m jarvis.google_auth` — si apre il browser, accedi con il
tuo account Google e autorizzi. Il token resta in config/google_token.json.
"""
from __future__ import annotations

from functools import lru_cache

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from .config import GOOGLE_CREDENZIALI, GOOGLE_TOKEN

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",   # leggere, creare bozze, etichette
    "https://www.googleapis.com/auth/gmail.send",     # inviare (sempre con approvazione)
    "https://www.googleapis.com/auth/drive.readonly", # cercare e leggere i tuoi file
    "https://www.googleapis.com/auth/drive.file",     # creare documenti nuovi (report)
]


class GoogleNonConfigurato(RuntimeError):
    pass


def credenziali(interattivo: bool = False) -> Credentials:
    creds = None
    if GOOGLE_TOKEN.exists():
        creds = Credentials.from_authorized_user_file(str(GOOGLE_TOKEN), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif interattivo:
        if not GOOGLE_CREDENZIALI.exists():
            raise GoogleNonConfigurato(
                f"Manca {GOOGLE_CREDENZIALI}: scaricalo dalla Google Cloud Console (vedi README).")
        creds = InstalledAppFlow.from_client_secrets_file(str(GOOGLE_CREDENZIALI), SCOPES).run_local_server(port=0)
    else:
        raise GoogleNonConfigurato(
            "Google non è ancora collegato: esegui 'collega_google.bat' (vedi README).")
    GOOGLE_TOKEN.write_text(creds.to_json(), encoding="utf-8")
    return creds


@lru_cache(maxsize=None)
def servizio(nome: str, versione: str):
    return build(nome, versione, credentials=credenziali(), cache_discovery=False)


def collegato() -> bool:
    return GOOGLE_TOKEN.exists()


if __name__ == "__main__":
    credenziali(interattivo=True)
    print("✅ Google collegato: Jarvis ora può usare Gmail e Drive.")
