'use strict';
/**
 * Contenuti dimostrativi. I dataset e i dati dei modelli AI sono marcati come NON verificati:
 * sostituiscili con i valori delle fonti ufficiali prima di andare online.
 */

const categories = [
  { name: 'AI News', slug: 'ai-news', color: '#4f46e5', sort: 1, description: 'Le notizie sull\'intelligenza artificiale che contano davvero: lanci di modelli, regole, aziende e impatto su lavoro e mercato.' },
  { name: 'Tendenze', slug: 'tendenze', color: '#eb6834', sort: 2, description: 'Le tendenze tecnologiche emergenti spiegate con dati e casi concreti, prima che diventino mainstream.' },
  { name: 'Guide pratiche', slug: 'guide', color: '#1baf7a', sort: 3, description: 'Soluzioni passo dopo passo per usare l\'AI e gli strumenti digitali nel lavoro e nella vita di tutti i giorni.' },
  { name: 'Guadagnare online', slug: 'guadagnare-online', color: '#008300', sort: 4, description: 'Modelli di business, side hustle e strategie concrete per generare reddito con l\'AI e il digitale.' },
  { name: 'Dati & Statistiche', slug: 'dati-statistiche', color: '#2a78d6', sort: 5, description: 'Statistiche ufficiali e ricerche indipendenti su tecnologia, lavoro e consumi digitali, trasformate in grafici chiari.' },
  { name: 'Social & Creator', slug: 'social-creator', color: '#e87ba4', sort: 6, description: 'Trend dei social network, creator economy e strategie di contenuto che funzionano.' },
];

const tools = [
  { name: 'Notion', slug: 'notion', category: 'Produttività', tagline: 'Workspace tutto-in-uno con assistente AI integrato', website: 'https://www.notion.so', network: 'PartnerStack', commission: 10, pricing: 'Gratis · piani a pagamento', free_plan: 1, rating: 4.6, keywords: 'Notion', featured: 1,
    pros: 'Note, database e wiki in un solo strumento\nAI integrata per riassunti e bozze\nCentinaia di template gratuiti', cons: 'Curva di apprendimento iniziale\nFunziona meglio online',
    description_md: '## Per chi è\n\nNotion è ideale per freelance, creator e piccoli team che vogliono organizzare progetti, contenuti e documentazione in un unico posto.\n\n## Il nostro giudizio\n\nLa flessibilità dei database lo rende perfetto per gestire un calendario editoriale o un CRM leggero.' },
  { name: 'Canva', slug: 'canva', category: 'Design', tagline: 'Grafica, video e presentazioni con strumenti AI', website: 'https://www.canva.com', network: 'Impact', commission: 15, pricing: 'Gratis · Pro a pagamento', free_plan: 1, rating: 4.7, keywords: 'Canva', featured: 1,
    pros: 'Migliaia di template professionali\nStrumenti AI per immagini e testi\nCollaborazione in tempo reale', cons: 'Le funzioni migliori sono nel piano Pro',
    description_md: 'Canva permette di creare grafiche per social, infografiche e miniature senza competenze di design.' },
  { name: 'Semrush', slug: 'semrush', category: 'SEO & Marketing', tagline: 'Suite completa per SEO, keyword research e analisi competitor', website: 'https://www.semrush.com', network: 'Impact', commission: 120, pricing: 'Prova gratuita · piani a pagamento', free_plan: 0, rating: 4.5, keywords: 'Semrush, keyword research', featured: 1,
    pros: 'Database keyword molto ampio\nMonitoraggio posizionamento e visibilità AI\nAudit tecnico del sito', cons: 'Prezzo elevato per chi inizia',
    description_md: 'Lo strumento di riferimento per pianificare contenuti che si posizionano su Google e monitorare la concorrenza.' },
  { name: 'Hostinger', slug: 'hostinger', category: 'Hosting', tagline: 'Hosting veloce ed economico per siti e progetti online', website: 'https://www.hostinger.it', network: 'Diretto', commission: 40, pricing: 'Piani a pagamento', free_plan: 0, rating: 4.4, keywords: 'Hostinger, hosting', featured: 0,
    pros: 'Prezzi d\'ingresso bassi\nPannello semplice\nDominio incluso in molti piani', cons: 'Rinnovi più cari del primo anno',
    description_md: 'Una scelta conveniente per lanciare un blog, un sito vetrina o un progetto di affiliazione.' },
  { name: 'Systeme.io', slug: 'systeme-io', category: 'Corsi & Funnel', tagline: 'Funnel, email marketing e corsi online in un\'unica piattaforma', website: 'https://systeme.io', network: 'Diretto', commission: 25, pricing: 'Gratis · piani a pagamento', free_plan: 1, rating: 4.3, keywords: 'Systeme.io, corso online, corsi online', featured: 0,
    pros: 'Piano gratuito generoso\nCorsi, email e pagine di vendita insieme\nAffiliazione ricorrente', cons: 'Design dei template meno curato',
    description_md: 'Perfetto per chi vuole vendere un infoprodotto o un corso senza mettere insieme cinque strumenti diversi.' },
  { name: 'ElevenLabs', slug: 'elevenlabs', category: 'Audio & Voce AI', tagline: 'Sintesi vocale e doppiaggio AI realistici', website: 'https://elevenlabs.io', network: 'PartnerStack', commission: 20, pricing: 'Gratis · piani a pagamento', free_plan: 1, rating: 4.6, keywords: 'ElevenLabs, voce AI, sintesi vocale', featured: 0,
    pros: 'Voci naturali anche in italiano\nClonazione vocale\nAPI per sviluppatori', cons: 'Crediti limitati nel piano gratuito',
    description_md: 'Ottimo per podcast, audiolibri, video faceless e doppiaggio di contenuti in più lingue.' },
  { name: 'Descript', slug: 'descript', category: 'Video & Podcast', tagline: 'Montaggio video e podcast modificando il testo', website: 'https://www.descript.com', network: 'PartnerStack', commission: 15, pricing: 'Gratis · piani a pagamento', free_plan: 1, rating: 4.4, keywords: 'Descript, montaggio video', featured: 0,
    pros: 'Editing come un documento di testo\nRimozione automatica delle pause\nSottotitoli automatici', cons: 'Supporto all\'italiano migliorabile in alcune funzioni',
    description_md: 'Riduce drasticamente i tempi di montaggio di video brevi e podcast.' },
];

// Modelli: valori DIMOSTRATIVI (verified = 0). Aggiornali dai listini ufficiali.
const models = [
  { name: 'Claude Opus', slug: 'claude-opus', provider: 'Anthropic', model_type: 'Multimodale', context_window: 200000, input_price: 15, output_price: 75, open_weights: 0, modalities: 'testo, immagini, documenti', best_for: 'Ragionamento complesso, coding avanzato, agenti e analisi di documenti lunghi.', website: 'https://www.anthropic.com/claude', score_reasoning: 96, score_coding: 96, score_speed: 62, score_value: 60,
    strengths: 'Ragionamento e scrittura di altissimo livello\nEccellente nel coding e nei flussi agentici\nContesto molto ampio', weaknesses: 'Costo per token elevato\nPiù lento dei modelli compatti', description: 'Il modello di punta della famiglia Claude, pensato per i compiti più impegnativi.' },
  { name: 'Claude Sonnet', slug: 'claude-sonnet', provider: 'Anthropic', model_type: 'Multimodale', context_window: 200000, input_price: 3, output_price: 15, open_weights: 0, modalities: 'testo, immagini, documenti', best_for: 'Uso quotidiano professionale: scrittura, coding e assistenti aziendali.', website: 'https://www.anthropic.com/claude', score_reasoning: 90, score_coding: 92, score_speed: 80, score_value: 85,
    strengths: 'Ottimo equilibrio qualità/prezzo\nForte nel coding\nVeloce', weaknesses: 'Meno profondo di Opus nei compiti più difficili', description: 'Il modello bilanciato della famiglia Claude.' },
  { name: 'Claude Haiku', slug: 'claude-haiku', provider: 'Anthropic', model_type: 'Multimodale', context_window: 200000, input_price: 1, output_price: 5, open_weights: 0, modalities: 'testo, immagini', best_for: 'Chatbot, classificazione e automazioni ad alto volume.', website: 'https://www.anthropic.com/claude', score_reasoning: 76, score_coding: 78, score_speed: 95, score_value: 92,
    strengths: 'Molto veloce\nEconomico', weaknesses: 'Meno adatto a ragionamenti lunghi', description: 'Il modello compatto e rapido della famiglia Claude.' },
  { name: 'GPT', slug: 'gpt', provider: 'OpenAI', model_type: 'Multimodale', context_window: 400000, input_price: 1.25, output_price: 10, open_weights: 0, modalities: 'testo, immagini, audio', best_for: 'Assistenza generale, contenuti, coding e integrazioni con l\'ecosistema ChatGPT.', website: 'https://openai.com', score_reasoning: 93, score_coding: 92, score_speed: 78, score_value: 86,
    strengths: 'Ecosistema molto ampio\nMultimodale nativo', weaknesses: 'Comportamento variabile tra versioni', description: 'La famiglia di modelli alla base di ChatGPT.' },
  { name: 'GPT mini', slug: 'gpt-mini', provider: 'OpenAI', model_type: 'LLM', context_window: 400000, input_price: 0.25, output_price: 2, open_weights: 0, modalities: 'testo, immagini', best_for: 'Applicazioni economiche ad alto volume.', website: 'https://openai.com', score_reasoning: 80, score_coding: 79, score_speed: 92, score_value: 94,
    strengths: 'Costo molto basso\nBuona qualità per il prezzo', weaknesses: 'Meno accurato sui compiti complessi', description: 'La versione compatta ed economica dei modelli GPT.' },
  { name: 'Gemini Pro', slug: 'gemini-pro', provider: 'Google', model_type: 'Multimodale', context_window: 1000000, input_price: 1.25, output_price: 10, open_weights: 0, modalities: 'testo, immagini, audio, video', best_for: 'Analisi di documenti e video molto lunghi, integrazione con Google Workspace.', website: 'https://deepmind.google/technologies/gemini/', score_reasoning: 92, score_coding: 89, score_speed: 76, score_value: 85,
    strengths: 'Contesto enorme\nComprensione video nativa', weaknesses: 'Prezzo che sale oltre certe soglie di contesto', description: 'Il modello avanzato della famiglia Gemini di Google.' },
  { name: 'Gemini Flash', slug: 'gemini-flash', provider: 'Google', model_type: 'Multimodale', context_window: 1000000, input_price: 0.3, output_price: 2.5, open_weights: 0, modalities: 'testo, immagini, audio, video', best_for: 'Risposte rapide ed economiche con contesto molto ampio.', website: 'https://deepmind.google/technologies/gemini/', score_reasoning: 82, score_coding: 80, score_speed: 94, score_value: 93,
    strengths: 'Veloce ed economico\nContesto ampio', weaknesses: 'Meno preciso nei compiti difficili', description: 'La versione rapida della famiglia Gemini.' },
  { name: 'Llama', slug: 'llama', provider: 'Meta', model_type: 'LLM', context_window: 128000, input_price: 0.2, output_price: 0.6, open_weights: 1, modalities: 'testo, immagini', best_for: 'Installazione on-premise, personalizzazione e privacy dei dati.', website: 'https://www.llama.com', score_reasoning: 80, score_coding: 77, score_speed: 85, score_value: 92,
    strengths: 'Pesi aperti\nGrande comunità', weaknesses: 'Richiede infrastruttura propria per l\'uso locale', description: 'La famiglia di modelli a pesi aperti di Meta. Prezzi indicativi tramite provider terzi.' },
  { name: 'Mistral Large', slug: 'mistral-large', provider: 'Mistral AI', model_type: 'LLM', context_window: 128000, input_price: 2, output_price: 6, open_weights: 0, modalities: 'testo', best_for: 'Aziende europee attente a sovranità del dato e GDPR.', website: 'https://mistral.ai', score_reasoning: 84, score_coding: 82, score_speed: 82, score_value: 82,
    strengths: 'Azienda europea\nBuon multilingua', weaknesses: 'Ecosistema più piccolo', description: 'Il modello di punta della francese Mistral AI.' },
  { name: 'DeepSeek', slug: 'deepseek', provider: 'DeepSeek', model_type: 'LLM', context_window: 128000, input_price: 0.28, output_price: 0.42, open_weights: 1, modalities: 'testo', best_for: 'Ragionamento a basso costo e sperimentazione con pesi aperti.', website: 'https://www.deepseek.com', score_reasoning: 86, score_coding: 85, score_speed: 74, score_value: 96,
    strengths: 'Prezzo molto basso\nPesi aperti', weaknesses: 'Valuta con attenzione la gestione dei dati per l\'uso aziendale', description: 'Modelli a pesi aperti dal costo molto contenuto.' },
];

// Dataset: valori DIMOSTRATIVI (verified = 0).
const datasets = [
  { title: 'Imprese che usano l\'intelligenza artificiale: Italia vs media UE', slug: 'imprese-ai-italia-ue', chart_type: 'line', unit: '%', period: '2021-2025', category: 'dati-statistiche',
    insight: 'L\'adozione dell\'AI nelle imprese cresce ogni anno, ma l\'Italia resta sotto la media europea (valori dimostrativi).',
    data_csv: 'Anno,Italia,Media UE\n2021,6,8\n2023,5,8\n2024,8,13\n2025,11,16',
    source_name: 'Eurostat (dataset isoc_eb_ai) — valori dimostrativi', source_url: 'https://ec.europa.eu/eurostat/web/digital-economy-and-society', license: 'CC BY 4.0',
    description_md: '## Come leggere il grafico\n\nLa percentuale indica le imprese con almeno 10 addetti che dichiarano di usare almeno una tecnologia di intelligenza artificiale.\n\n> **Nota per la redazione:** sostituisci i valori con quelli aggiornati del dataset Eurostat *isoc_eb_ai* e spunta "Dati verificati".' },
  { title: 'Per cosa gli italiani usano l\'AI generativa', slug: 'usi-ai-generativa', chart_type: 'hbar', unit: '%', period: '2025', category: 'tendenze',
    insight: 'Cercare informazioni e scrivere testi sono gli usi più diffusi dell\'AI generativa (valori dimostrativi).',
    data_csv: 'Uso,Quota utenti\nCercare informazioni,58\nScrivere o correggere testi,47\nStudio e formazione,35\nLavoro e produttività,33\nCreare immagini,21\nProgrammare,12',
    source_name: 'Sondaggio di esempio — valori dimostrativi', source_url: 'https://www.istat.it', license: 'CC BY 4.0',
    description_md: 'Percentuale di utenti di AI generativa che dichiara ciascun utilizzo (risposte multiple).' },
  { title: 'Da dove arrivano i ricavi dei creator digitali', slug: 'ricavi-creator', chart_type: 'donut', unit: '%', period: '2025', category: 'social-creator',
    insight: 'Le sponsorizzazioni restano la prima fonte di reddito dei creator, ma affiliazioni e prodotti digitali crescono (valori dimostrativi).',
    data_csv: 'Fonte,Quota\nSponsorizzazioni,38\nAffiliazioni,22\nProdotti digitali e corsi,17\nPubblicità piattaforme,14\nAbbonamenti e donazioni,9',
    source_name: 'Ricerca di esempio — valori dimostrativi', source_url: 'https://www.istat.it', license: 'CC BY 4.0',
    description_md: 'Composizione media dei ricavi dichiarati da creator con almeno 10.000 follower.' },
];

const glossary = [
  ['LLM (Large Language Model)', 'Un LLM è un modello di intelligenza artificiale addestrato su enormi quantità di testo per comprendere e generare linguaggio naturale, come quelli alla base di ChatGPT, Claude e Gemini.'],
  ['Token', 'Un token è l\'unità minima di testo elaborata da un modello linguistico: in italiano 1.000 token corrispondono in media a circa 750 parole. Le API AI si pagano a token.'],
  ['Finestra di contesto', 'La finestra di contesto è la quantità massima di testo, misurata in token, che un modello AI può considerare in una singola richiesta, inclusi prompt e risposta.'],
  ['RAG (Retrieval-Augmented Generation)', 'La RAG è una tecnica che fa cercare al modello AI informazioni in documenti esterni prima di rispondere, riducendo errori e permettendo di usare dati aziendali aggiornati.'],
  ['Prompt engineering', 'Il prompt engineering è l\'arte di scrivere istruzioni chiare e strutturate per ottenere risposte migliori da un modello di intelligenza artificiale.'],
  ['Allucinazione', 'Un\'allucinazione è una risposta di un modello AI che sembra plausibile ma contiene informazioni false o inventate.'],
  ['Fine-tuning', 'Il fine-tuning è l\'addestramento aggiuntivo di un modello già esistente su dati specifici, per adattarlo a un compito, uno stile o un settore.'],
  ['Agente AI', 'Un agente AI è un sistema che usa un modello linguistico per pianificare ed eseguire azioni in autonomia, ad esempio cercare sul web, usare software o completare flussi di lavoro.'],
  ['Embedding', 'Un embedding è la rappresentazione numerica del significato di un testo, usata per ricerche semantiche, raccomandazioni e sistemi RAG.'],
  ['Pesi aperti (open weights)', 'Un modello a pesi aperti è un modello AI i cui parametri sono scaricabili, così da poterlo eseguire e personalizzare sui propri server nel rispetto della licenza.'],
  ['Modello multimodale', 'Un modello multimodale è un\'AI in grado di comprendere o generare più tipi di contenuto, come testo, immagini, audio e video.'],
  ['GEO (Generative Engine Optimization)', 'Il GEO è l\'insieme di tecniche per far comparire e citare i propri contenuti nelle risposte dei motori di ricerca generativi come ChatGPT Search, Perplexity, Gemini e Google AI Overviews.'],
  ['AEO (Answer Engine Optimization)', 'L\'AEO è l\'ottimizzazione dei contenuti per fornire risposte dirette a domande specifiche, così da comparire in featured snippet, box "Le persone hanno chiesto anche" e assistenti vocali.'],
  ['E-E-A-T', 'E-E-A-T sta per Experience, Expertise, Authoritativeness e Trustworthiness: i criteri con cui Google valuta la qualità e l\'affidabilità di un contenuto e di chi lo scrive.'],
  ['Link di affiliazione', 'Un link di affiliazione è un collegamento tracciato verso un prodotto o servizio che riconosce una commissione a chi lo promuove quando l\'utente acquista.'],
  ['llms.txt', 'Il file llms.txt è una proposta di standard: un file Markdown alla radice del sito che presenta ai modelli linguistici i contenuti più importanti in formato facile da leggere.'],
];

const pages = [
  { title: 'Chi siamo', slug: 'chi-siamo', meta_description: 'Chi c\'è dietro TrendMind, la nostra missione e come lavoriamo per raccontare AI, tecnologia e opportunità digitali con i dati.',
    content_md: 'TrendMind è una testata indipendente che racconta **intelligenza artificiale, tecnologia e nuove opportunità di guadagno** con un approccio basato sui dati.\n\n## La nostra missione\n\nAiutare professionisti, creator e curiosi a capire cosa sta cambiando, separando i fatti dall\'hype e trasformando le notizie in azioni concrete.\n\n## Cosa trovi qui\n\n- News e analisi sui modelli AI\n- Confronti e strumenti interattivi come il [calcolatore dei costi API](/modelli-ai/calcolatore-costi)\n- [Infografiche](/dati) costruite su fonti ufficiali\n- Guide pratiche e [strumenti testati](/strumenti)\n\nLeggi la nostra [metodologia editoriale](/p/metodologia-editoriale).' },
  { title: 'Metodologia editoriale', slug: 'metodologia-editoriale', meta_description: 'Come selezioniamo le fonti, verifichiamo i dati, valutiamo i modelli AI e gestiamo affiliazioni e correzioni.',
    content_md: '## Fonti\n\nOgni articolo cita le fonti primarie usate: comunicati ufficiali, documentazione tecnica, istituti di statistica (ISTAT, Eurostat, OCSE) e ricerche accademiche.\n\n## Verifica dei dati\n\nI dati numerici vengono controllati sulla fonte originale. Le schede dei modelli AI e i dataset riportano un badge di verifica con la data dell\'ultimo controllo.\n\n## Valutazioni dei modelli AI\n\nI punteggi (0-100) su ragionamento, coding, velocità e rapporto qualità/prezzo combinano benchmark pubblici e test pratici della redazione su compiti reali in italiano.\n\n## Affiliazioni e indipendenza\n\nAlcuni link sono di affiliazione: ci permettono di mantenere il sito gratuito. Le aziende non possono acquistare recensioni positive né modificare i nostri giudizi. I contenuti sponsorizzati sono sempre etichettati.\n\n## Correzioni\n\nSe trovi un errore scrivici dalla pagina [contatti](/p/contatti): correggiamo e aggiorniamo la data di modifica.\n\n## Uso dell\'intelligenza artificiale\n\nUsiamo strumenti AI per ricerca e bozze, ma ogni contenuto è verificato, rivisto e firmato da una persona della redazione.' },
  { title: 'Disclosure affiliazioni', slug: 'disclosure-affiliazioni', meta_description: 'Come funzionano i link di affiliazione su TrendMind e perché non influenzano le nostre valutazioni.',
    content_md: 'TrendMind partecipa a programmi di affiliazione (ad esempio Amazon, Impact, PartnerStack e programmi diretti dei produttori).\n\nQuando acquisti tramite un nostro link potremmo ricevere una commissione, **senza alcun costo aggiuntivo per te**.\n\n- I link di affiliazione sono marcati con `rel="sponsored"` come richiesto da Google.\n- Le valutazioni sono indipendenti dalle commissioni.\n- In qualità di Affiliato Amazon, riceviamo un guadagno dagli acquisti idonei.' },
  { title: 'Privacy e cookie', slug: 'privacy', meta_description: 'Informativa sul trattamento dei dati personali e sull\'uso dei cookie.',
    content_md: '> **Nota:** questo è un modello da completare con il tuo consulente privacy prima della pubblicazione.\n\n## Titolare del trattamento\n\n[Inserisci ragione sociale, indirizzo ed email].\n\n## Dati raccolti\n\n- **Newsletter:** indirizzo email e data del consenso, usati solo per inviarti la newsletter. Puoi cancellarti in qualsiasi momento.\n- **Statistiche:** dati aggregati e anonimi sulle pagine visitate e sui click verso siti partner.\n\n## Cookie\n\nIl sito usa solo cookie tecnici. Eventuali cookie di analisi o pubblicità vengono installati solo con il tuo consenso.\n\n## I tuoi diritti\n\nPuoi chiedere accesso, rettifica o cancellazione dei tuoi dati scrivendo alla redazione.' },
  { title: 'Contatti', slug: 'contatti', meta_description: 'Contatta la redazione di TrendMind per segnalazioni, correzioni, collaborazioni e partnership.',
    content_md: 'Scrivici a **redazione@example.com** per:\n\n- segnalare una notizia o un errore\n- proporre una collaborazione o un contributo\n- partnership commerciali e contenuti sponsorizzati (sempre etichettati)\n\nRispondiamo entro 2 giorni lavorativi.' },
];

const articles = [
  {
    title: 'GEO: come farsi citare da ChatGPT, Perplexity e Gemini',
    slug: 'geo-come-farsi-citare-da-chatgpt-perplexity-gemini', type: 'guide', category: 'tendenze', featured: 1, daysAgo: 0.2,
    focus_keyword: 'GEO', tools: ['semrush'],
    meta_title: 'GEO: come farsi citare da ChatGPT, Perplexity e Gemini',
    meta_description: 'Cos\'è il GEO (Generative Engine Optimization) e le 8 tecniche pratiche per far citare i tuoi contenuti nelle risposte dei motori AI. Guida con checklist.',
    excerpt: 'I motori di ricerca generativi stanno cambiando il modo in cui le persone trovano informazioni. Ecco come rendere i tuoi contenuti la fonte che citano.',
    tldr: 'Il GEO (Generative Engine Optimization) è l\'ottimizzazione dei contenuti per essere citati nelle risposte di ChatGPT, Perplexity, Gemini e Google AI Overviews. Funziona con risposte dirette, dati verificabili, fonti citate, struttura chiara e segnali di autorevolezza dell\'autore.',
    takeaways: 'Il GEO non sostituisce la SEO: la estende ai motori che generano risposte\nI motori AI citano passaggi brevi, autonomi e ricchi di dati\nFonti primarie, statistiche e autore riconoscibile aumentano le citazioni\nllms.txt, dati strutturati e versioni Markdown facilitano la lettura da parte degli LLM',
    sources: [
      { title: 'GEO: Generative Engine Optimization (paper)', url: 'https://arxiv.org/abs/2311.09735', publisher: 'arXiv' },
      { title: 'La proposta llms.txt', url: 'https://llmstxt.org/', publisher: 'llmstxt.org' },
      { title: 'Linee guida sui contenuti utili e affidabili', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', publisher: 'Google Search Central' },
    ],
    faq: [
      { q: 'Il GEO sostituisce la SEO?', a: 'No. I motori generativi si appoggiano spesso a indici di ricerca tradizionali per trovare le fonti: un sito ben posizionato su Google e Bing ha più probabilità di essere citato. Il GEO aggiunge tecniche specifiche per rendere i contenuti facili da estrarre e citare.' },
      { q: 'Quanto tempo serve per vedere risultati con il GEO?', a: 'Per i motori che cercano sul web in tempo reale, come Perplexity o ChatGPT Search, i miglioramenti possono vedersi in poche settimane dall\'indicizzazione. Per le conoscenze interne dei modelli servono invece mesi, perché dipendono dai cicli di addestramento.' },
      { q: 'Devo bloccare i crawler AI nel robots.txt?', a: 'Dipende dall\'obiettivo. Se vuoi essere citato, consenti i crawler di ricerca come OAI-SearchBot e PerplexityBot. Puoi invece bloccare separatamente i crawler usati solo per l\'addestramento, come GPTBot o Google-Extended.' },
      { q: 'Come misuro le citazioni nei motori AI?', a: 'Controlla nei dati di analisi il traffico in arrivo da chatgpt.com, perplexity.ai e gemini.google.com, e verifica periodicamente le risposte alle domande chiave del tuo settore con strumenti di monitoraggio della visibilità AI.' },
    ],
    content_md: `Quando un utente chiede a un assistente AI "qual è il miglior modo per…", non riceve dieci link blu: riceve **una risposta**, con poche fonti citate. Essere una di quelle fonti è l'obiettivo del **GEO**, la Generative Engine Optimization.

In questa guida vediamo cos'è, perché conta e le tecniche pratiche per aumentare le probabilità di citazione. Se sei nuovo a questi termini, trovi le definizioni nel nostro [glossario AI](/glossario).

## Cos'è il GEO e in cosa differisce dalla SEO?

La SEO classica ottimizza le pagine per comparire nei risultati di ricerca. Il GEO ottimizza i **singoli passaggi** di una pagina perché un modello linguistico li selezioni, li riassuma e li citi come fonte.

| | SEO tradizionale | GEO |
|---|---|---|
| Obiettivo | Posizione nei risultati | Citazione nella risposta |
| Unità ottimizzata | Pagina | Passaggio / paragrafo |
| Segnali chiave | Link, keyword, esperienza utente | Chiarezza, dati, fonti, autorevolezza |
| Metrica | Click organici | Menzioni e traffico da AI |

## Perché i motori AI citano alcuni contenuti e non altri?

La ricerca accademica che ha introdotto il termine GEO ha testato diverse modifiche ai contenuti: aggiungere **citazioni di fonti**, **statistiche** e **frasi di esperti** ha aumentato la visibilità nelle risposte generative fino al 40% nei loro esperimenti.

> I contenuti che vengono citati sono quelli che un modello può estrarre senza ambiguità e verificare con altre fonti.

## Le 8 tecniche GEO che funzionano

### 1. Rispondi subito alla domanda

Apri ogni articolo con una risposta diretta di 40-60 parole che nomini esplicitamente l'argomento ("Il GEO è…"). È il passaggio che i motori estraggono più spesso.

### 2. Inserisci dati concreti

Numeri, percentuali e date rendono un passaggio "citabile". Meglio ancora se accompagnati da un grafico e da una tabella, come le nostre [infografiche con fonte](/dati).

### 3. Cita fonti primarie

Linka studi, documentazione ufficiale e istituti di statistica. Un contenuto che cita fonti verificabili viene percepito come più affidabile anche dai modelli.

### 4. Struttura in blocchi autonomi

Usa sottotitoli in forma di domanda e paragrafi brevi che abbiano senso anche letti da soli.

### 5. Mostra chi scrive

Una pagina autore con competenze, esperienza e profili verificabili rafforza i segnali E-E-A-T.

### 6. Usa i dati strutturati

Gli schema FAQPage, HowTo, Article e Dataset aiutano i motori a capire il ruolo di ogni parte della pagina.

### 7. Pubblica llms.txt e versioni Markdown

Un file [llms.txt](/llms.txt) e una versione Markdown di ogni articolo riducono il "rumore" dell'HTML per i crawler AI.

### 8. Aggiorna e dichiaralo

Le informazioni recenti vengono preferite: mostra la data di aggiornamento e rivedi i contenuti chiave almeno ogni 3-6 mesi.

## Come impostare il robots.txt per i crawler AI?

Distingui due famiglie di crawler: quelli che **cercano** per rispondere agli utenti (da consentire se vuoi essere citato) e quelli che **raccolgono dati per l'addestramento** (che puoi decidere di bloccare). Questo sito gestisce entrambe le opzioni dal pannello di controllo.

## Checklist GEO rapida

- Risposta diretta nelle prime righe
- Almeno 3 dati numerici con fonte
- Almeno 2 link a fonti primarie
- FAQ con domande reali degli utenti
- Autore con biografia e competenze
- Dati strutturati validi
- Data di aggiornamento visibile

Per analizzare le keyword e monitorare la visibilità puoi usare una suite come Semrush.

[[tool:semrush]]`,
  },
  {
    title: 'Come guadagnare con l\'intelligenza artificiale: 7 modelli di business concreti',
    slug: 'come-guadagnare-con-intelligenza-artificiale', type: 'list', category: 'guadagnare-online', featured: 0, daysAgo: 1,
    focus_keyword: 'guadagnare con l\'intelligenza artificiale', tools: ['canva', 'elevenlabs', 'systeme-io', 'notion'],
    meta_title: 'Guadagnare con l\'intelligenza artificiale: 7 modi concreti',
    meta_description: 'Sette modi reali per guadagnare con l\'intelligenza artificiale: servizi, contenuti, prodotti digitali e automazioni. Costi, strumenti e primi passi.',
    excerpt: 'Dai servizi per le aziende ai prodotti digitali: sette strade concrete, con costi di partenza, strumenti e tempi realistici.',
    tldr: 'Per guadagnare con l\'intelligenza artificiale le strade più concrete sono vendere servizi potenziati dall\'AI, creare contenuti e canali faceless, realizzare prodotti digitali, offrire automazioni alle piccole imprese e fare consulenza. Il fattore decisivo non è lo strumento, ma la competenza in un settore specifico.',
    takeaways: 'L\'AI riduce i costi di produzione, non sostituisce la competenza di settore\nI servizi alle aziende sono la via più rapida al primo incasso\nProdotti digitali e affiliazioni creano entrate ricorrenti nel tempo\nParti da un problema specifico e da un pubblico preciso',
    sources: [
      { title: 'The economic potential of generative AI', url: 'https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier', publisher: 'McKinsey' },
      { title: 'Future of Jobs Report', url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/', publisher: 'World Economic Forum' },
    ],
    faq: [
      { q: 'Si può guadagnare con l\'AI senza saper programmare?', a: 'Sì. La maggior parte dei modelli di business descritti, come servizi di contenuto, prodotti digitali e consulenza, richiede competenze di settore e di comunicazione più che di programmazione. Gli strumenti no-code coprono quasi tutte le esigenze iniziali.' },
      { q: 'Quanto si può guadagnare con l\'intelligenza artificiale?', a: 'Dipende dal modello scelto: un servizio freelance può generare le prime centinaia di euro in poche settimane, mentre prodotti digitali e canali di contenuto richiedono mesi ma possono crescere senza aumentare le ore lavorate.' },
      { q: 'Quanto costa iniziare?', a: 'Si può partire con meno di 50 euro al mese combinando piani gratuiti e uno o due abbonamenti a strumenti AI. Il costo maggiore è il tempo dedicato a imparare e trovare i primi clienti.' },
    ],
    content_md: `Guadagnare con l'intelligenza artificiale è possibile, ma serve metodo. L'AI ha abbassato drasticamente il costo di produrre testi, immagini, audio e codice. Questo crea opportunità, ma anche molta concorrenza: vince chi combina gli strumenti con **una competenza specifica** e un **pubblico preciso**.

Ecco sette modelli di business concreti, dal più rapido al più scalabile.

## 1. Servizi di contenuto potenziati dall'AI

Scrittura di articoli, newsletter, schede prodotto e post social per piccole aziende. L'AI accelera bozza e ricerca; tu porti strategia, tono di voce e verifica.

- **Tempo al primo incasso:** 2-4 settimane
- **Investimento iniziale:** sotto i 30 € al mese
- **Strumenti:** un assistente AI, Canva per le grafiche

## 2. Canali video "faceless"

Video brevi o lunghi senza mostrare il volto, con voce sintetica e montaggio rapido. Funzionano bene nicchie educative: finanza personale, storia, tecnologia.

[[tool:elevenlabs]]

## 3. Prodotti digitali

Template, guide, prompt pack, mini-corsi. Si creano una volta e si vendono molte volte. Una piattaforma come Systeme.io gestisce pagine di vendita, email e consegna.

## 4. Automazioni per le piccole imprese

Molte attività locali perdono ore in attività ripetitive: risposte alle email, preventivi, prenotazioni. Un pacchetto di automazioni da 300-1.500 € è un'offerta comprensibile e misurabile.

## 5. Siti di nicchia con affiliazioni

Contenuti utili che confrontano prodotti e strumenti, monetizzati con link di affiliazione e pubblicità. È il modello di questo sito: lento all'inizio, ma con entrate che si accumulano nel tempo.

## 6. Consulenza e formazione AI per aziende

Le aziende sanno di dover adottare l'AI ma non sanno da dove partire. Workshop e percorsi di adozione sono tra i servizi a più alto valore.

## 7. Micro-SaaS basati sulle API

Piccoli software che risolvono un problema preciso usando le API dei modelli. Prima di partire, stima i costi con il nostro [calcolatore dei costi API](/modelli-ai/calcolatore-costi).

## Quale modello scegliere per guadagnare con l'intelligenza artificiale?

| Modello | Velocità | Scalabilità | Competenze richieste |
|---|---|---|---|
| Servizi di contenuto | Alta | Bassa | Scrittura |
| Video faceless | Media | Alta | Storytelling |
| Prodotti digitali | Media | Alta | Esperienza di settore |
| Automazioni | Alta | Media | Processi aziendali |
| Siti di nicchia | Bassa | Alta | SEO |
| Consulenza | Alta | Bassa | Autorevolezza |
| Micro-SaaS | Bassa | Molto alta | Tecniche |

## Come iniziare questa settimana?

Scegli **un** modello, definisci un cliente ideale e prepara un'offerta in una pagina. Organizza idee e contatti in uno strumento come Notion e fissa l'obiettivo del primo incasso entro 30 giorni.

[[newsletter]]`,
    steps: [
      { name: 'Scegli una nicchia', text: 'Parti da un settore che conosci o da un problema che sai risolvere meglio della media.' },
      { name: 'Definisci un\'offerta', text: 'Descrivi in una frase cosa fai, per chi e con quale risultato misurabile.' },
      { name: 'Prepara gli strumenti', text: 'Configura un assistente AI, uno strumento di design e una pagina di presentazione.' },
      { name: 'Trova i primi 3 clienti', text: 'Contatta direttamente 20 potenziali clienti con un esempio gratuito del tuo lavoro.' },
    ],
  },
  {
    title: 'Quanto costano le API dei modelli AI: guida al calcolo dei token',
    slug: 'quanto-costano-api-modelli-ai-token', type: 'guide', category: 'guide', featured: 0, daysAgo: 2,
    focus_keyword: 'API dei modelli AI', tools: [],
    meta_title: 'Quanto costano le API AI? Guida al calcolo dei token',
    meta_description: 'Come si calcola il costo API AI: token di input e output, esempi pratici in euro e 6 strategie per ridurre la spesa. Con calcolatore gratuito.',
    excerpt: 'Token, prezzi per milione e costi nascosti: come stimare la spesa reale prima di lanciare un progetto basato sull\'AI.',
    tldr: 'Il costo API AI si calcola moltiplicando i token di input e di output per i rispettivi prezzi al milione. Ad esempio 1.000 richieste al giorno da 800 token in input e 400 in output con un modello da 3 $ e 15 $ per milione costano circa 252 dollari al mese.',
    takeaways: 'Si pagano separatamente token di input e di output\nL\'output costa in genere da 2 a 5 volte l\'input\nCaching e API batch possono ridurre la spesa fino al 50%\nScegliere il modello giusto per ogni compito è la leva più forte',
    sources: [
      { title: 'Pricing', url: 'https://www.anthropic.com/pricing', publisher: 'Anthropic' },
      { title: 'API Pricing', url: 'https://openai.com/api/pricing/', publisher: 'OpenAI' },
      { title: 'Gemini API pricing', url: 'https://ai.google.dev/pricing', publisher: 'Google' },
    ],
    faq: [
      { q: 'Che cos\'è un token?', a: 'Un token è un frammento di testo: in italiano 1.000 token corrispondono in media a circa 750 parole. I modelli leggono e generano testo token per token, e le API fatturano in base al loro numero.' },
      { q: 'Perché l\'output costa di più dell\'input?', a: 'Generare un token richiede un passaggio completo del modello per ogni parola prodotta, mentre l\'input viene elaborato in parallelo. Per questo il prezzo dei token di output è più alto.' },
      { q: 'Esiste un modo gratuito per usare le API AI?', a: 'Diversi provider offrono crediti di prova o piani gratuiti con limiti di utilizzo. Per progetti in produzione conviene comunque stimare i costi a regime con un calcolatore.' },
    ],
    content_md: `Prima di costruire un chatbot, un'automazione o un micro-SaaS sulle API dei modelli AI conviene rispondere a una domanda semplice: **quanto costerà ogni mese?** La risposta dipende da tre numeri: richieste, token di input e token di output.

## Come si calcola il costo di una chiamata API?

La formula è:

> costo = (token input × prezzo input + token output × prezzo output) ÷ 1.000.000

I prezzi sono espressi per **milione di token**. Trovi i valori aggiornati di ogni modello nella nostra [classifica dei modelli AI](/modelli-ai).

## Esempio pratico: un chatbot di assistenza

Ipotizziamo 1.000 conversazioni al giorno, 800 token in input (istruzioni + domanda + contesto) e 400 token in output.

| Voce | Valore |
|---|---|
| Token input al mese | 24 milioni |
| Token output al mese | 12 milioni |
| Costo con modello da 3 $ / 15 $ | 72 $ + 180 $ = 252 $ |
| Costo con modello da 0,25 $ / 2 $ | 6 $ + 24 $ = 30 $ |

La differenza tra due modelli può superare l'**800%**: scegliere bene vale più di qualsiasi ottimizzazione successiva.

## Quali sono i costi nascosti delle API dei modelli AI?

- **Contesto che cresce:** nelle chat, ogni messaggio reinvia la cronologia precedente.
- **Documenti allegati:** un PDF di 50 pagine può valere oltre 30.000 token.
- **Tentativi e errori:** le richieste ripetute si pagano tutte.

## 6 strategie per ridurre la spesa

1. Usa modelli compatti per classificazione ed estrazione.
2. Attiva il **prompt caching** per istruzioni ripetute.
3. Sposta i lavori non urgenti sulle **API batch**.
4. Limita la lunghezza massima delle risposte.
5. Riassumi la cronologia delle conversazioni lunghe.
6. Recupera solo i passaggi rilevanti con la [RAG](/glossario/rag-retrieval-augmented-generation) invece di inviare documenti interi.

## Calcola il tuo scenario

Inserisci i tuoi numeri nel [calcolatore gratuito dei costi API](/modelli-ai/calcolatore-costi) e confronta tutti i modelli in un colpo solo.

[[model:claude-sonnet]]`,
  },
  {
    title: 'Modelli AI open weights o proprietari: quale scegliere per la tua azienda',
    slug: 'modelli-ai-open-weights-o-proprietari', type: 'analysis', category: 'ai-news', featured: 0, daysAgo: 3,
    focus_keyword: 'open weights', tools: [],
    meta_title: 'Modelli AI open weights o proprietari: quale scegliere',
    meta_description: 'Pro e contro dei modelli open weights rispetto ai modelli AI proprietari: costi, privacy, prestazioni e controllo. Tabella di confronto e criteri di scelta.',
    excerpt: 'Privacy, costi e prestazioni: i criteri per decidere tra un modello da installare in casa e un servizio via API.',
    tldr: 'I modelli open weights convengono quando servono controllo totale dei dati, personalizzazione profonda e volumi molto alti; i modelli proprietari via API convengono quando contano prestazioni di punta, velocità di avvio e zero gestione dell\'infrastruttura.',
    takeaways: 'Open weights significa pesi scaricabili, non sempre licenza open source\nI modelli proprietari restano in testa sui compiti più complessi\nIl costo totale include GPU, manutenzione e personale\nMolte aziende adottano un approccio ibrido',
    sources: [
      { title: 'AI Index Report', url: 'https://hai.stanford.edu/ai-index', publisher: 'Stanford HAI' },
      { title: 'Regolamento europeo sull\'intelligenza artificiale (AI Act)', url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', publisher: 'EUR-Lex' },
    ],
    faq: [
      { q: 'Open weights e open source sono la stessa cosa?', a: 'No. Open weights indica che i parametri del modello sono scaricabili, ma la licenza può imporre limiti d\'uso. Open source in senso stretto richiede anche libertà su codice, dati e redistribuzione.' },
      { q: 'Un modello open weights è più sicuro per la privacy?', a: 'Può esserlo, perché installandolo sui propri server i dati non escono dall\'azienda. La sicurezza effettiva dipende però da come viene gestita l\'infrastruttura.' },
      { q: 'Conviene un approccio ibrido?', a: 'Spesso sì: un modello open weights per i dati sensibili e i volumi elevati, e un modello proprietario di punta per i compiti più complessi.' },
    ],
    content_md: `La scelta tra un modello di intelligenza artificiale **open weights** e un modello **proprietario** è una delle decisioni tecnologiche più importanti per chi porta l'AI in azienda. Non esiste una risposta unica: esistono criteri.

## Cosa significa "open weights"?

Un modello open weights rende disponibili i suoi parametri: puoi scaricarlo, eseguirlo sui tuoi server e adattarlo con il fine-tuning. Esempi noti sono le famiglie [Llama](/modelli-ai/llama) e [DeepSeek](/modelli-ai/deepseek).

## Quali sono i vantaggi dei modelli proprietari?

- Prestazioni di punta su ragionamento e coding
- Nessuna infrastruttura da gestire
- Aggiornamenti continui e funzioni avanzate (strumenti, agenti, multimodalità)

## Confronto rapido

| Criterio | Open weights | Proprietario via API |
|---|---|---|
| Controllo dei dati | Totale | Dipende dal contratto |
| Prestazioni massime | Buone | Ottime |
| Costo a basso volume | Alto (infrastruttura) | Basso |
| Costo ad alto volume | Basso | Alto |
| Tempo di avvio | Settimane | Ore |
| Personalizzazione | Profonda | Limitata |

## Come decidere in 3 domande

1. **I dati possono uscire dall'azienda?** Se no, valuta seriamente l'installazione locale.
2. **Quanti token elaborerai al mese?** Oltre certi volumi l'infrastruttura propria si ripaga.
3. **Quanto è complesso il compito?** Per analisi e agenti avanzati i modelli di punta fanno ancora la differenza.

Per confrontare prezzi e caratteristiche usa la pagina [confronto modelli](/modelli-ai/confronto).

[[chart:imprese-ai-italia-ue]]`,
  },
  {
    title: 'Video brevi e AI: come sta cambiando il lavoro dei creator',
    slug: 'video-brevi-ai-lavoro-creator', type: 'analysis', category: 'social-creator', featured: 0, daysAgo: 4,
    focus_keyword: 'video brevi', tools: ['descript', 'canva'],
    meta_title: 'Video brevi e AI: come cambia il lavoro dei creator',
    meta_description: 'Come gli strumenti AI trasformano la produzione di video brevi: tempi, costi, nuove professioni e rischi per i creator. Analisi e consigli pratici.',
    excerpt: 'Montaggio automatico, voci sintetiche e sottotitoli istantanei: cosa cambia per chi vive di contenuti.',
    tldr: 'Per i creator l\'AI riduce drasticamente i tempi di produzione dei video brevi, automatizzando montaggio, sottotitoli e doppiaggio. Il vantaggio competitivo si sposta dalla capacità tecnica all\'idea, alla personalità e alla relazione con la community.',
    takeaways: 'Montaggio e sottotitoli automatici riducono i tempi di produzione\nIl doppiaggio AI apre mercati in altre lingue\nL\'autenticità diventa il vero differenziale\nLe piattaforme chiedono di etichettare i contenuti generati con l\'AI',
    sources: [
      { title: 'Etichettatura dei contenuti generati con l\'AI', url: 'https://support.google.com/youtube/answer/14328491', publisher: 'YouTube Help' },
      { title: 'Digital News Report', url: 'https://reutersinstitute.politics.ox.ac.uk/digital-news-report', publisher: 'Reuters Institute' },
    ],
    faq: [
      { q: 'Devo dichiarare se un video usa l\'AI?', a: 'Le principali piattaforme richiedono di segnalare i contenuti realistici generati o modificati con l\'AI, soprattutto se potrebbero essere scambiati per reali. Verifica le regole aggiornate di ciascuna piattaforma.' },
      { q: 'Quali strumenti AI usano i creator?', a: 'I più diffusi servono per montaggio basato sul testo, sottotitoli automatici, generazione di miniature, voce sintetica e doppiaggio in altre lingue.' },
      { q: 'L\'AI sostituirà i creator?', a: 'L\'AI automatizza la produzione, ma il pubblico segue persone, idee e punti di vista. I creator che usano l\'AI per pubblicare di più e meglio ne traggono vantaggio.' },
    ],
    content_md: `Fino a pochi anni fa, uno dei video brevi verticali da 60 secondi ben montato richiedeva ore di lavoro. Oggi strumenti AI per montaggio, sottotitoli e audio comprimono gran parte di quel tempo.

## Cosa automatizza oggi l'AI nella produzione di video brevi?

- **Montaggio dal testo:** modifichi la trascrizione e il video si aggiorna.
- **Sottotitoli automatici** con stili animati.
- **Rimozione di pause e intercalari.**
- **Doppiaggio** in altre lingue mantenendo la voce.
- **Miniature e grafiche** generate da un prompt.

[[tool:descript]]

## Come cambiano i ricavi dei creator?

La diversificazione è la regola: sponsorizzazioni, affiliazioni e prodotti digitali convivono. Il grafico qui sotto mostra una composizione tipica.

[[chart:ricavi-creator]]

## Quali sono i rischi?

1. **Saturazione:** se produrre costa meno, la concorrenza aumenta.
2. **Fiducia:** contenuti troppo artificiali riducono l'engagement.
3. **Regole delle piattaforme:** l'obbligo di etichettatura è in crescita.

## Cosa fare adesso?

Usa l'AI per le attività ripetitive e investi il tempo risparmiato in idee, format riconoscibili e relazione con la community. Trovi gli strumenti testati nella sezione [strumenti](/strumenti?categoria=Video%20%26%20Podcast).`,
  },
  {
    title: 'Nasce TrendMind: AI, tecnologia e opportunità digitali raccontate con i dati',
    slug: 'nasce-trendmind', type: 'news', category: 'ai-news', featured: 0, daysAgo: 6,
    focus_keyword: 'TrendMind', tools: [],
    meta_title: 'Nasce TrendMind: AI e tecnologia raccontate con i dati',
    meta_description: 'TrendMind è la nuova testata su intelligenza artificiale, modelli AI, dati e opportunità di guadagno online. Ecco cosa troverai e come lavoriamo.',
    excerpt: 'Una testata indipendente con news, confronti tra modelli, infografiche e strumenti interattivi.',
    tldr: 'TrendMind è una nuova testata italiana su intelligenza artificiale e tecnologia che unisce news verificate, confronti tra modelli AI, infografiche basate su dati ufficiali e guide pratiche per lavorare e guadagnare online.',
    takeaways: 'News e analisi con fonti sempre citate\nConfronto tra modelli e calcolatore dei costi API\nInfografiche libere da incorporare\nNewsletter settimanale gratuita',
    sources: [
      { title: 'Dati strutturati per gli articoli', url: 'https://developers.google.com/search/docs/appearance/structured-data/article', publisher: 'Google Search Central' },
      { title: 'Linee guida E-E-A-T', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', publisher: 'Google Search Central' },
    ],
    faq: [
      { q: 'TrendMind è gratuito?', a: 'Sì, tutti i contenuti sono gratuiti. Il sito si sostiene con link di affiliazione e pubblicità, sempre dichiarati.' },
      { q: 'Ogni quanto esce la newsletter?', a: 'Una volta a settimana, il lunedì, con le notizie più importanti, un dato da conoscere e uno strumento utile.' },
      { q: 'Posso usare le vostre infografiche?', a: 'Sì, ogni infografica ha un codice di incorporamento gratuito che include il credito alla fonte.' },
    ],
    content_md: `Oggi parte **TrendMind**, un progetto editoriale dedicato a intelligenza artificiale, tecnologia e nuove opportunità digitali.

## Perché un'altra testata sull'AI?

Perché tra annunci, hype e opinioni manca spesso l'essenziale: **dati verificabili** e **indicazioni pratiche**. Ogni nostro contenuto si apre con una risposta rapida, cita le fonti e indica la data di aggiornamento.

## Cosa trovi su TrendMind?

- [News e analisi](/articoli) sui modelli e sulle aziende AI
- La [classifica dei modelli AI](/modelli-ai) con prezzi e valutazioni
- Il [calcolatore dei costi API](/modelli-ai/calcolatore-costi)
- [Dati e infografiche](/dati) libere da incorporare
- [Strumenti](/strumenti) testati per lavorare e guadagnare online
- Il [glossario](/glossario) con 15+ termini spiegati in una frase

## Come lavoriamo?

Lo trovi nella nostra [metodologia editoriale](/p/metodologia-editoriale): fonti primarie, verifica dei numeri, separazione netta tra contenuti editoriali e sponsorizzati.

> Un buon contenuto sull'AI deve lasciarti con una decisione più chiara, non con più rumore.

Iscriviti alla newsletter per ricevere ogni lunedì il Radar AI della settimana.`,
  },
];

module.exports = { categories, tools, models, datasets, glossary, pages, articles };
