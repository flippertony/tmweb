"""PrestaShop (Webservice API, sola lettura): ordini, vendite, scorte, clienti."""
from __future__ import annotations

import json
from collections import Counter
from datetime import date, timedelta

import httpx

from .. import config
from . import strumento


def _sito(nome: str) -> dict:
    s = (config.siti().get("siti") or {}).get(nome)
    if not s or not s.get("prestashop"):
        disponibili = [n for n, d in (config.siti().get("siti") or {}).items() if d.get("prestashop")]
        raise ValueError(f"Negozio PrestaShop '{nome}' non configurato. Disponibili: {disponibili}")
    return s


def _get(nome: str, risorsa: str, params: dict) -> dict:
    s = _sito(nome)
    r = httpx.get(s["url"].rstrip("/") + f"/api/{risorsa}",
                  params={"output_format": "JSON", **params},
                  auth=(s["prestashop"]["chiave_api"], ""), timeout=40)
    r.raise_for_status()
    return r.json() if r.content.strip() else {}


def _ordini(negozio: str, giorni: int) -> list[dict]:
    dal = (date.today() - timedelta(days=giorni)).isoformat()
    al = (date.today() + timedelta(days=1)).isoformat()
    return _get(negozio, "orders", {
        "display": "[id,reference,id_customer,current_state,total_paid_tax_incl,payment,date_add]",
        "filter[date_add]": f"[{dal},{al}]", "date": "1", "sort": "[date_add_DESC]", "limit": "200",
    }).get("orders", [])


@strumento("ps_negozi", "Elenca i negozi PrestaShop configurati.", "lettura")
def ps_negozi() -> str:
    return json.dumps([{"nome": n, "url": d.get("url"), "cliente": d.get("cliente")}
                       for n, d in (config.siti().get("siti") or {}).items() if d.get("prestashop")],
                      ensure_ascii=False)


@strumento("ps_ordini", "Ordini recenti di un negozio PrestaShop.", "lettura",
           {"negozio": {"type": "string"}, "giorni": {"type": "integer", "description": "default 7"}},
           ["negozio"])
def ps_ordini(negozio: str, giorni: int = 7) -> str:
    ordini = _ordini(negozio, giorni)
    return json.dumps(ordini[:50], ensure_ascii=False) if ordini else "Nessun ordine nel periodo."


@strumento("ps_vendite", "Riepilogo vendite di un negozio: numero ordini, fatturato, scontrino medio, "
           "metodi di pagamento.", "lettura",
           {"negozio": {"type": "string"}, "giorni": {"type": "integer", "description": "default 30"}},
           ["negozio"])
def ps_vendite(negozio: str, giorni: int = 30) -> str:
    ordini = _ordini(negozio, giorni)
    totale = sum(float(o.get("total_paid_tax_incl") or 0) for o in ordini)
    return json.dumps({
        "periodo_giorni": giorni, "ordini": len(ordini), "fatturato_ivato": round(totale, 2),
        "scontrino_medio": round(totale / len(ordini), 2) if ordini else 0,
        "pagamenti": Counter(o.get("payment") for o in ordini),
    }, ensure_ascii=False)


@strumento("ps_scorte_basse", "Prodotti con quantità disponibile sotto una soglia.", "lettura",
           {"negozio": {"type": "string"}, "soglia": {"type": "integer", "description": "default 3"}},
           ["negozio"])
def ps_scorte_basse(negozio: str, soglia: int = 3) -> str:
    scorte = _get(negozio, "stock_availables", {
        "display": "[id_product,id_product_attribute,quantity]",
        "filter[quantity]": f"[-1000000,{soglia}]", "limit": "100"}).get("stock_availables", [])
    if not scorte:
        return "Nessun prodotto sotto soglia."
    ids = sorted({str(s["id_product"]) for s in scorte})[:100]
    prodotti = _get(negozio, "products", {"display": "[id,name,reference,active]",
                                          "filter[id]": f"[{'|'.join(ids)}]"}).get("products", [])
    nomi = {str(p["id"]): p for p in prodotti}
    return json.dumps([{**s, "nome": nomi.get(str(s["id_product"]), {}).get("name"),
                        "riferimento": nomi.get(str(s["id_product"]), {}).get("reference")}
                       for s in scorte if nomi.get(str(s["id_product"]), {}).get("active") != "0"],
                      ensure_ascii=False)


@strumento("ps_clienti_recenti", "Clienti registrati di recente in un negozio.", "lettura",
           {"negozio": {"type": "string"}, "giorni": {"type": "integer", "description": "default 30"}},
           ["negozio"])
def ps_clienti_recenti(negozio: str, giorni: int = 30) -> str:
    dal = (date.today() - timedelta(days=giorni)).isoformat()
    return json.dumps(_get(negozio, "customers", {
        "display": "[id,firstname,lastname,email,company,date_add,newsletter]",
        "filter[date_add]": f"[{dal},{(date.today() + timedelta(days=1)).isoformat()}]", "date": "1",
        "sort": "[date_add_DESC]", "limit": "100"}).get("customers", []), ensure_ascii=False)
