# TrendMind — piattaforma editoriale AI con CMS, monetizzazione e SEO · GEO · AEO

Sistema completo per un sito di **news tech e AI** che guadagna con **affiliazioni, pubblicità e newsletter**.
Pubblica news sui modelli AI, infografiche con dati ufficiali, trend social, guide pratiche e opportunità di guadagno.
È ottimizzato per Google (SEO), per i box di risposta e gli assistenti vocali (AEO) e per farsi citare da ChatGPT, Perplexity, Gemini e Claude (GEO).

- **Leggero e veloce**: Node.js + SQLite integrato, HTML generato dal server, nessun framework lato client, nessun font esterno.
- **Zero servizi esterni obbligatori**: un solo processo e un solo file di database.
- **Pannello di controllo (CMS)** completo in italiano su `/admin`.

---

## Avvio rapido

Requisiti: **Node.js 22.5 o superiore** (usa il modulo SQLite integrato `node:sqlite`).

```bash
npm install
cp .env.example .env       # imposta SITE_URL e SESSION_SECRET
npm run seed               # contenuti demo (facoltativo)
npm start                  # http://localhost:3000
```

Apri `http://localhost:3000/admin`: al primo accesso crei l'account amministratore.

Comandi utili:

| Comando | Cosa fa |
|---|---|
| `npm start` | avvia il sito |
| `npm run dev` | avvio con riavvio automatico quando modifichi i file |
| `npm run seed` | carica i contenuti demo se il database è vuoto |
| `npm run seed -- --force` | cancella i contenuti (non gli admin) e ricarica i demo |
| `npm test` | 12 test automatici su database temporaneo |

### Con Docker

```bash
docker build -t trendmind .
docker run -d -p 3000:3000 -v trendmind-data:/app/data \
  -e SITE_URL=https://tuodominio.it -e SESSION_SECRET=una-stringa-lunga-e-casuale -e TRUST_PROXY=1 trendmind
```

Il volume `/app/data` contiene database e immagini caricate: è l'unica cosa da salvare nei backup.

---

## Cosa c'è sul sito pubblico

| Sezione | URL | Perché fa guadagnare / posizionare |
|---|---|---|
| Home | `/` | articolo in evidenza, "di tendenza ora", classifica modelli, dati della settimana, strumenti consigliati |
| Articoli | `/articoli/slug` | risposta rapida, punti chiave, indice, FAQ, passaggi How-to, fonti, box affiliati, autore |
| Versione Markdown | `/articoli/slug.md` | lettura facilitata per crawler e agenti AI (GEO) |
| Categorie, tag, autori | `/categoria/…`, `/tag/…`, `/autore/…` | pagine hub con schema ItemList, ProfilePage e Person (E-E-A-T) |
| Modelli AI | `/modelli-ai`, `/modelli-ai/slug` | classifica ordinabile, schede con FAQ automatiche, badge di verifica dati |
| Confronto | `/modelli-ai/confronto?m=a,b` | pagine "X vs Y", tra le query più cercate |
| Calcolatore costi API | `/modelli-ai/calcolatore-costi` | strumento interattivo: attira link spontanei e visite ricorrenti |
| Strumenti | `/strumenti`, `/strumenti/slug` | recensioni con pro/contro, voto, coupon, alternative |
| Link affiliati | `/go/slug` | redirect tracciato, `rel="sponsored nofollow"`, escluso dall'indice |
| Dati e infografiche | `/dati`, `/dati/slug` | grafici SVG + tabella + CSV + **codice di incorporamento** (link building) |
| Glossario | `/glossario`, `/glossario/slug` | definizioni brevi: perfette per featured snippet e risposte AI |
| Ricerca | `/cerca?q=` | ricerca full-text (SQLite FTS5) su articoli, glossario e strumenti |
| Pagine | `/p/slug` | chi siamo, metodologia editoriale, disclosure, privacy, contatti |

Tema chiaro/scuro, layout responsive, accessibilità (skip link, ARIA, contrasto, `prefers-reduced-motion`).

---

## Il pannello di controllo (`/admin`)

- **Dashboard**: visualizzazioni, click affiliati, **ricavi stimati** (click × tasso di conversione × commissione), nuovi iscritti, grafico 30 giorni, articoli più letti, contenuti da migliorare.
- **Editor articoli**
  - Markdown con barra strumenti, anteprima reale e scorciatoie (Ctrl+B, Ctrl+I, Ctrl+S)
  - campi dedicati: **risposta rapida** (AEO), punti chiave, **FAQ**, **passaggi How-to**, **fonti** (GEO)
  - **punteggio SEO · AEO · GEO in tempo reale** con suggerimenti (lo stesso calcolo usato dal server)
  - anteprima del risultato Google, contatori per meta title e description
  - bozze, **pubblicazione programmata**, anteprima privata, duplicazione, modifica minore senza cambiare data
  - libreria media con caricamento diretto
  - **redirect 301 automatico** quando cambi lo slug di un contenuto pubblicato
- **Affiliazioni**: link, network, commissione, coupon, pro/contro, voto e **parole chiave per l'auto-link**.
- **Modelli AI**, **Dati & infografiche** (anteprima grafico dal vivo), **Glossario**, **Categorie**, **Pagine**, **Redirect 301**.
- **Newsletter**: iscritti con data del consenso, fonte di iscrizione, esportazione CSV per Brevo, MailerLite, Beehiiv…
- **Utenti** con ruoli: `admin` (tutto), `editor` (contenuti e pubblicazione), `author` (scrive bozze e le invia in revisione).
- **Centro SEO · GEO · AEO**: medie dei punteggi, problemi (keyword mancanti, cannibalizzazione, thin content, FAQ o fonti assenti), ricalcolo globale.
- **Impostazioni**: identità, AdSense, slot annunci, analytics, crawler AI, IndexNow, codici di verifica, newsletter.

### Blocchi (shortcode) da usare negli articoli

| Shortcode | Risultato |
|---|---|
| `[[tool:slug]]` | box affiliato con voto, pro/contro, prezzo, coupon e pulsante |
| `[[chart:slug]]` | infografica del dataset |
| `[[model:slug]]` | scheda tecnica di un modello AI |
| `[[ad]]` | annuncio AdSense in quella posizione |
| `[[newsletter]]` | box di iscrizione |
| `[[callout:testo]]` | riquadro in evidenza |

Si inseriscono anche dal menu "+ Blocco…" dell'editor.

---

## Monetizzazione

1. **Affiliazioni** — ogni link passa da `/go/slug`: click contati per strumento e pagina di provenienza, link marcati `sponsored`. L'**auto-link** trasforma la prima occorrenza delle parole chiave di uno strumento in link affiliato (massimo configurabile per articolo, mai dentro titoli o altri link).
2. **Pubblicità** — inserisci client e slot AdSense: header, sidebar e in-article (inserito dopo il paragrafo N).
   *Nello Spazio economico europeo Google richiede una CMP certificata: incolla il suo codice in "Codice extra in &lt;head&gt;".*
3. **Newsletter** — box in pagina, nel footer e negli articoli; la lista è esportabile.
4. **Contenuti sponsorizzati** — etichettati automaticamente in pagina e nei dati strutturati.
5. **Asset che attirano link** — calcolatore, confronti, infografiche incorporabili e glossario fanno crescere l'autorità del dominio, cioè il traffico organico che monetizzi.

---

## SEO · AEO · GEO: cosa è già automatico

**SEO tecnica**
- Canonical, meta robots `max-image-preview:large`, Open Graph, Twitter Card, hreflang
- `sitemap.xml` con immagini e `sitemap-news.xml` (Google News, ultime 48 ore)
- URL puliti, slash finale rimosso con 301, paginazione con `rel=prev/next`
- tag con meno di 3 articoli in `noindex` (niente thin content), ricerca interna e `/go/` esclusi
- feed RSS e JSON Feed, manifest, micro-cache HTML e compressione gzip

**Dati strutturati (JSON-LD in un unico `@graph`)**
Organization/NewsMediaOrganization con policy editoriali, WebSite + SearchAction, NewsArticle / AnalysisNewsArticle / Article, **FAQPage**, **HowTo**, **Speakable**, BreadcrumbList, Person, ProfilePage, Dataset con file scaricabili, SoftwareApplication con Review, DefinedTermSet, ItemList, WebApplication.

**AEO** — risposta rapida in apertura, sottotitoli in forma di domanda, FAQ, punti chiave, tabelle ed elenchi, Speakable per gli assistenti vocali.

**GEO**
- `llms.txt` e `llms-full.txt` generati automaticamente; versione Markdown di ogni articolo
- fonti citate (anche nello schema `citation`), dati numerici, autore con competenze verificabili, date di aggiornamento visibili
- `robots.txt` che distingue i **crawler di ricerca AI** (OAI-SearchBot, PerplexityBot, Claude-SearchBot…: consentiti per essere citati) dai **crawler di addestramento** (GPTBot, ClaudeBot, Google-Extended, CCBot…: scelta tua dal pannello)
- **IndexNow**: notifica immediata a Bing (che alimenta anche Copilot e ChatGPT Search) a ogni pubblicazione

---

## Prima di andare online

1. Imposta in `.env`: `SITE_URL` (dominio definitivo con https), `SESSION_SECRET` lungo e casuale, `NODE_ENV=production`, `TRUST_PROXY=1` se sei dietro Nginx/Cloudflare.
2. **Sostituisci i dati dimostrativi**: i dataset e i prezzi dei modelli AI caricati dal seed sono esempi (badge "dati dimostrativi"). Inserisci i valori delle fonti ufficiali (ISTAT, Eurostat, OCSE, listini dei provider) e spunta "Dati verificati".
3. Completa la pagina **Privacy** con il tuo consulente e aggiorna email e ragione sociale.
4. Inserisci i tuoi **link di affiliazione** reali in Affiliazioni (finché il campo è vuoto si usa il sito ufficiale).
5. Completa il profilo autore (bio, qualifica, competenze, profili esterni): è un segnale E-E-A-T.
6. Verifica il sito su Google Search Console e Bing Webmaster Tools, invia le sitemap e attiva IndexNow.
7. Imposta un backup periodico della cartella `data/`.

---

## Struttura del progetto

```
src/
  server.js            avvio Express, sicurezza, cache, redirect
  config.js            configurazione da .env
  db/                  schema SQLite, connessione, seed e contenuti demo
  lib/
    content.js         query dei contenuti e rendering articoli
    markdown.js        Markdown + shortcode + auto-link affiliati + sanitizzazione
    seo.js             meta tag e JSON-LD
    charts.js          infografiche SVG generate dal server
    components.js      box affiliato, scheda modello, annunci, newsletter
    auth.js            password scrypt, sessioni, CSRF, rate limit
    settings.js        impostazioni modificabili dal pannello
    indexnow.js        ping IndexNow
  routes/
    public.js          pagine del sito
    seo.js             robots, sitemap, llms.txt, feed
    admin.js           pannello di controllo
views/                 template EJS (sito e pannello)
public/
  css/                 stili sito e pannello
  js/site.js           tema, newsletter, calcolatore, tabelle ordinabili, consenso cookie
  js/admin.js          editor, anteprima, media, punteggio live
  js/seo-analyzer.js   analisi SEO/AEO/GEO condivisa tra browser e server
test/                  test automatici
```

## Sicurezza

Password con scrypt, cookie di sessione `HttpOnly` + `SameSite=Lax` (+ `Secure` in produzione), token CSRF su ogni modifica, limite tentativi di login, upload limitati a immagini raster (SVG escluso), sanitizzazione dell'HTML generato dal Markdown, header di sicurezza e query SQL parametrizzate.

## Licenza

GPL-3.0 (vedi `LICENSE`).
