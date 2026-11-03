# 🤖 Jarvis: il tuo assistente AI di lavoro

Jarvis gira sul tuo PC Windows e lavora con i tuoi strumenti: **Gmail, Google Drive, WordPress,
PrestaShop** e un **CRM integrato**. Ci parli dalla dashboard nel browser (anche a voce), impara
dalle tue correzioni e svolge da solo i compiti ripetitivi, chiedendoti il permesso per quelli delicati.

Il ragionamento è affidato a Claude (Anthropic). Dati, CRM, memoria e password restano sul tuo PC.

---

## Cosa sa fare

| Area | Cosa fa |
|---|---|
| 💬 **Chat e voce** | Gli scrivi o gli parli (microfono in Chrome/Edge), può leggerti le risposte ad alta voce |
| 📧 **Gmail** | Cerca e legge le email, prepara bozze di risposta, etichetta, invia (solo con approvazione) |
| 📁 **Drive** | Cerca e legge documenti e fogli, crea Google Doc (report, bozze di preventivo) |
| 🌐 **WordPress** | Legge articoli e pagine, crea bozze, aggiorna, pubblica (solo con approvazione) |
| 🛒 **PrestaShop** | Ordini, vendite, scorte basse, nuovi clienti (sola lettura) |
| 👥 **CRM** | Contatti, pipeline commerciale (nuovo → preventivo → vinto), storico attività, follow-up |
| 🩺 **Siti clienti** | Controlla ogni 30 minuti se sono online, veloci e con SSL valido, e ti avvisa |
| 🔎 **Web** | Cerca su internet e legge pagine (concorrenti, SEO, informazioni) |
| 🧠 **Memoria** | Ricorda il tuo profilo, i clienti, i prezzi, le procedure e le tue preferenze |
| ⏰ **Automazioni** | Briefing del mattino, gestione dei nuovi lead, report dei negozi, auto-revisione settimanale |

---

## Installazione (circa 15 minuti)

1. **Installa Python** da <https://www.python.org/downloads/>. Durante l'installazione spunta
   **"Add python.exe to PATH"**.
2. **Scarica questo progetto**: su GitHub premi *Code → Download ZIP* ed estrailo, ad esempio in
   `C:\Jarvis`.
3. **Crea la chiave API di Claude** su <https://platform.claude.com>: accedi, poi *API Keys → Create Key*,
   e carica un credito iniziale (bastano 10-20 $ per iniziare).
4. Fai doppio clic su **`installa.bat`**. Quando si apre il Blocco note, incolla la chiave dopo
   `ANTHROPIC_API_KEY=` e salva.
5. Fai doppio clic su **`avvia_jarvis.bat`**: si apre la dashboard su <http://localhost:8765>.

Per avviarlo in automatico all'accensione del PC, esegui una volta **`avvio_automatico.bat`**.

### Primo passo consigliato
Nella chat clicca **"Presentati e chiedimi le informazioni per compilare il mio profilo"**: Jarvis ti
intervista e compila `memoria/profilo.md`. Poi compila `memoria/listino.md` con i tuoi prezzi reali.

---

## Collegare Gmail e Drive

Serve una sola volta, circa 10 minuti:

1. Vai su <https://console.cloud.google.com/> e crea un progetto (es. "Jarvis").
2. *API e servizi → Libreria*: abilita **Gmail API** e **Google Drive API**.
3. *API e servizi → Schermata consenso OAuth*: tipo **Esterno**, inserisci nome app e la tua email.
   In **Utenti di test** aggiungi il tuo indirizzo Gmail.
4. *API e servizi → Credenziali → Crea credenziali → ID client OAuth*, tipo **App desktop**.
5. Scarica il JSON, rinominalo **`google_credentials.json`** e mettilo nella cartella `config`.
6. Fai doppio clic su **`collega_google.bat`**, accedi e autorizza. Google potrebbe avvisarti che
   "l'app non è verificata": è normale, perché l'app è tua. Clicca *Avanzate → Continua*.
7. Riavvia Jarvis.

## Collegare i siti WordPress e PrestaShop

Apri **`config/siti.yaml`** con il Blocco note: dentro ci sono esempi già pronti.

- **WordPress**: nel sito vai su *Utenti → Profilo → Password applicazione*, crea una password
  chiamata "Jarvis" e copiala in `password_applicazione`. Non è la password di login, e puoi
  revocarla quando vuoi.
- **PrestaShop**: *Parametri avanzati → Webservice*, abilita il webservice e aggiungi una chiave
  con permesso **GET** su `orders`, `products`, `stock_availables` e `customers`.
- I siti che hanno solo `url` vengono soltanto monitorati.

Le modifiche a `siti.yaml` valgono subito, senza riavviare.

---

## Autonomia: cosa fa da solo e cosa ti chiede

Ogni azione ha un livello di rischio. Il valore `JARVIS_AUTONOMIA` nel file `.env` decide cosa
Jarvis può fare senza chiederti il permesso:

| Tipo di azione | Esempi | Livello 1 | Livello 2 (default) | Livello 3 |
|---|---|---|---|---|
| Lettura | leggere email, CRM, ordini, siti | ✅ da solo | ✅ da solo | ✅ da solo |
| Reversibile | CRM, memoria, bozze Gmail, Google Doc | ✋ chiede | ✅ da solo | ✅ da solo |
| Esterna | bozze e modifiche su WordPress | ✋ chiede | ✋ chiede | ✅ da solo |
| Critica | **inviare email, pubblicare, cambiare le sue regole** | ✋ chiede | ✋ chiede | ✋ chiede |

Le richieste in attesa compaiono in **Approvazioni**: clicchi *Approva ed esegui* oppure *Rifiuta*.

Ci sono altre tre protezioni:
- **Pausa di emergenza**: un pulsante ferma le automazioni e manda in approvazione ogni azione
  che non sia una lettura.
- **Tetto di spesa**: oltre `JARVIS_BUDGET_GIORNALIERO_USD` le automazioni si fermano fino al giorno dopo.
- **Registro**: ogni azione eseguita resta registrata e consultabile.

Jarvis tratta il contenuto delle email e delle pagine web come materiale da analizzare, non come ordini.

---

## Come arricchirlo e migliorarlo

È tutto in file di testo che puoi modificare:

```
memoria/
  identita.md        chi è Jarvis e le sue regole (cambia solo con la tua approvazione)
  profilo.md         chi sei tu, i tuoi servizi, il tuo stile
  listino.md         prezzi e condizioni, usati per i preventivi
  lezioni.md         preferenze imparate dalle tue correzioni (le scrive Jarvis)
  clienti/*.md       una scheda per cliente
  procedure/*.md     come svolgere i compiti ricorrenti, passo per passo
config/
  automazioni.yaml   cosa fa e quando
  siti.yaml          i siti dei clienti e i loro accessi
```

**Jarvis migliora da solo così:**
1. Quando lo correggi ("non scrivere così", "con questo cliente dai del tu") salva la lezione.
2. Ogni venerdì alle 17:40 rilegge il registro della settimana, gli errori e le azioni che hai
   rifiutato. Poi aggiorna le procedure e ti propone miglioramenti e nuove automazioni.

**Per aggiungere un'automazione** basta un blocco in `config/automazioni.yaml`, senza programmare:

```yaml
  - nome: promemoria-preventivi
    titolo: Preventivi da sollecitare
    quando: "0 11 * * 2,4"        # martedì e giovedì alle 11
    effort: low
    prompt: |
      Trova nel CRM le opportunità in fase "preventivo" ferme da più di 5 giorni
      e prepara per ognuna una bozza di sollecito gentile in Gmail.
```

---

## Costi indicativi

- **Chat quotidiana + automazioni di default**: in genere 20-60 $ al mese, a seconda di quanto lo usi.
- Il controllo dei siti è gratuito (non usa l'AI). La gestione dei lead chiama l'AI solo se ci
  sono email nuove.
- La spesa stimata del giorno è visibile in basso a sinistra nella dashboard.
- Per spendere meno puoi abbassare l'`effort` delle automazioni o cambiare `JARVIS_MODELLO` nel
  file `.env`.

---

## Struttura del codice

```
jarvis/
  server.py        dashboard web e API (solo su localhost)
  brain.py         dialogo con Claude e uso degli strumenti
  scheduler.py     automazioni pianificate
  db.py            database locale (dati/jarvis.db)
  tools/           strumenti: gmail, drive, wordpress, prestashop, crm, siti, memoria, sistema
  static/          interfaccia (HTML/CSS/JS)
```

Per aggiungere uno strumento crea una funzione con il decoratore `@strumento(...)` in `jarvis/tools/`,
indicando il livello di rischio.

## Prossimi passi possibili
- Notifiche su Telegram e uso di Jarvis dal telefono
- Parola d'attivazione "Jarvis" sempre in ascolto
- Report SEO e velocità con PageSpeed Insights per ogni cliente
- Fatturazione e scadenze (es. collegamento a Fatture in Cloud)
