"""Google Drive: cercare e leggere documenti, creare nuovi Google Doc (report, preventivi)."""
from __future__ import annotations

import io
import json

from googleapiclient.http import MediaIoBaseUpload

from ..google_auth import servizio
from . import strumento

ESPORTA = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
}


def _drive():
    return servizio("drive", "v3")


@strumento("drive_cerca",
           "Cerca file su Google Drive per nome o contenuto. Restituisce id, nome, tipo, data modifica, link.",
           "lettura",
           {"testo": {"type": "string"}, "max_risultati": {"type": "integer", "description": "default 15"}},
           ["testo"])
def drive_cerca(testo: str, max_risultati: int = 15) -> str:
    t = testo.replace("\\", "\\\\").replace("'", "\\'")
    r = _drive().files().list(
        q=f"(name contains '{t}' or fullText contains '{t}') and trashed = false",
        pageSize=min(max_risultati, 50), orderBy="modifiedTime desc",
        fields="files(id,name,mimeType,modifiedTime,webViewLink)").execute()
    return json.dumps(r["files"], ensure_ascii=False) if r.get("files") else "Nessun file trovato."


@strumento("drive_leggi", "Legge il contenuto testuale di un file Drive (Documenti, Fogli come CSV, file di testo).",
           "lettura", {"file_id": {"type": "string"}}, ["file_id"])
def drive_leggi(file_id: str) -> str:
    d = _drive()
    meta = d.files().get(fileId=file_id, fields="name,mimeType").execute()
    mime = meta["mimeType"]
    if mime in ESPORTA:
        dati = d.files().export(fileId=file_id, mimeType=ESPORTA[mime]).execute()
    elif mime.startswith("text/") or mime in ("application/json", "text/csv"):
        dati = d.files().get_media(fileId=file_id).execute()
    else:
        return f"'{meta['name']}' è di tipo {mime}: per ora leggo solo documenti, fogli e file di testo."
    testo = dati.decode("utf-8", "replace") if isinstance(dati, bytes) else str(dati)
    return f"# {meta['name']}\n\n{testo[:30000]}"


@strumento("drive_crea_documento",
           "Crea un nuovo Google Doc nel Drive dell'utente (es. report, bozza di preventivo). "
           "Il contenuto è testo semplice o Markdown.",
           "reversibile", {"titolo": {"type": "string"}, "contenuto": {"type": "string"}},
           ["titolo", "contenuto"])
def drive_crea_documento(titolo: str, contenuto: str) -> str:
    media = MediaIoBaseUpload(io.BytesIO(contenuto.encode("utf-8")), mimetype="text/plain", resumable=False)
    f = _drive().files().create(
        body={"name": titolo, "mimeType": "application/vnd.google-apps.document"},
        media_body=media, fields="id,webViewLink").execute()
    return f"Documento creato: {f['webViewLink']}"
