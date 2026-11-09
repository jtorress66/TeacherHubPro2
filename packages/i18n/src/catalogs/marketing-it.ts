import type { MarketingMessages } from './marketing-types.ts';

// Il testo del sito pubblico in italiano: pagine di marketing, la chat del sito e le pagine
// legali. Tutto ciò che dice deve essere vero dell'app oggi.

export const marketingIt: MarketingMessages = {
  marketing: {
    nav: {
      label: 'Principale',
      features: 'Funzionalità',
      useCases: "Casi d'uso",
      pricing: 'Prezzi',
      contact: 'Contatti',
      logIn: 'Accedi',
      startTrial: 'Prova gratuita',
    },
    footer: {
      tagline:
        "Lo spazio di lavoro con IA per docenti, scuole e famiglie che praticano l'istruzione parentale.",
      product: 'Prodotto',
      useCases: "Casi d'uso",
      company: 'Azienda',
      legal: 'Note legali e fiducia',
      ai: 'Funzionalità di IA',
      integrations: 'Integrazioni',
      enterprise: 'Scuole e distretti',
      help: 'Aiuto',
      rights: '© {year} TeacherHubPro',
    },
    landing: {
      metaTitle: 'TeacherHubPro: il Suo spazio di lavoro didattico con IA',
      metaDescription:
        "Pianifichi le lezioni, registri le presenze, valuti, crei diapositive, giochi e quiz e condivida i progressi con le famiglie, con un'IA che prepara bozze mentre Lei decide. Prova gratuita di 7 giorni.",
      featuresTitle: 'Tutto ciò che serve per una settimana di insegnamento',
      featuresIntro:
        'Un unico spazio per pianificare, insegnare, valutare e comunicare con le famiglie.',
      howTitle: 'Come funziona',
      how1Title: 'Configuri le Sue classi',
      how1Text:
        "Aggiunga una classe e importi l'elenco degli studenti da un foglio di calcolo o da Google Classroom.",
      how2Title: "Lasci che l'IA prepari una bozza",
      how2Text:
        "Chieda un piano settimanale, diapositive, una scheda di esercizi, un quiz o un'intera settimana di preparazione. Ogni risultato è una bozza.",
      how3Title: 'Rivedere e usare',
      how3Text:
        'Modifichi ciò che vuole, poi insegni, assegni, valuti e condivida. Nulla raggiunge studenti o famiglie finché Lei non lo approva.',
      whoTitle: 'Pensato per',
      whoIntro: 'Docenti in classe, famiglie con istruzione parentale, tutor e intere scuole.',
      trustTitle: 'Dati degli studenti, trattati con cura',
      trustIntro: "Gli studenti sono minorenni e l'app è costruita tenendone conto.",
      trust1:
        'Studenti e genitori usano link privati, non account. I link sono casuali, conservati solo come hash e possono essere revocati.',
      trust2:
        'Ogni dato appartiene a una sola scuola e solo i docenti di quella scuola possono accedervi.',
      trust3:
        "All'IA viene inviato solo ciò che serve per un compito. Le analisi sugli studenti ricevono numeri, mai un nome.",
      trust4: "I voti e i suggerimenti dell'IA restano bozze finché un docente non li conferma.",
      trustMore: 'Visiti il centro fiducia',
      pricingTitle: 'Prezzi semplici',
      pricingIntro:
        'Inizi con una prova gratuita di {days} giorni. Non serve una carta di pagamento.',
      pricingSee: 'Vedi tutti i piani',
      faqTitle: 'Domande',
      faq1Q: 'Mi serve una carta di pagamento per la prova?',
      faq1A:
        'No. La prova Le dà accesso completo per 7 giorni; sceglie un piano solo se vuole continuare.',
      faq2Q: "L'IA valuta al posto mio?",
      faq2A:
        'Suggerisce punteggi e commenti per le risposte aperte. Lei conferma ogni voto prima che conti.',
      faq3Q: 'Quali lingue supporta?',
      faq3A:
        "L'app è completa in inglese e spagnolo, e l'IA scrive nella lingua che Lei sceglie. Francese, portoghese, tedesco, italiano e cinese sono tradotti in parte.",
      faq4Q: 'Funziona con Google Classroom?',
      faq4A:
        'Sì. Può importare gli elenchi degli studenti, pubblicare compiti e documenti Word, inviare presentazioni come Google Slides e creare quiz con Google Forms.',
      faq5Q: 'Può usarla tutta la mia scuola?',
      faq5A:
        "Sì. I piani Scuola e Distretto aggiungono i docenti a un'unica scuola, con pagine di amministrazione e importazione in blocco.",
      ctaTitle: 'La provi con le Sue classi',
      ctaText:
        "Configuri una classe in pochi minuti e lasci che l'IA prepari la bozza della Sua prossima settimana.",
    },
    feature: {
      lesson_planner: {
        title: 'Pianificatore di lezioni',
        text: "Piani settimanali con gli standard Common Core, abbozzati dall'IA e modificati da Lei.",
      },
      ai_assistant: {
        title: 'Assistente IA',
        text: 'Schede di esercizi, quiz, riassunti e attività nella Sua lingua.',
      },
      presentations: {
        title: 'Presentazioni',
        text: "Diapositive abbozzate dall'IA, presentate a schermo intero, stampate o inviate a Google Classroom.",
      },
      gradebook: {
        title: 'Registro dei voti e pagelle',
        text: 'Categorie ponderate, compiti e pagelle in PDF con il logo della Sua scuola.',
      },
      attendance: {
        title: 'Presenze',
        text: 'Presenze giornaliere con ritardi, assenze giustificate e report.',
      },
      assignments: {
        title: 'Verifiche online e valutazione con IA',
        text: "Crei domande o importi una verifica in PDF; gli studenti rispondono da un link; Lei conferma i voti suggeriti dall'IA.",
      },
      games: {
        title: 'Giochi e giochi dal vivo',
        text: 'Giochi educativi in molte modalità e giochi dal vivo in classe a cui gli studenti partecipano con un PIN.',
      },
      learning: {
        title: 'Percorsi di apprendimento',
        text: "Lezioni abbozzate dall'IA con verifiche di comprensione, assegnate agli studenti tramite link privati.",
      },
      families: {
        title: 'Portale per le famiglie',
        text: 'Ogni famiglia riceve un link privato, in sola lettura, ai voti confermati e alle presenze.',
      },
      command_center: {
        title: 'Centro di controllo',
        text: 'Le lezioni di oggi, cosa valutare, gli studenti che potrebbero aver bisogno di aiuto e suggerimenti.',
      },
      prep_agent: {
        title: 'Agente di preparazione',
        text: 'Una frase diventa una settimana: piano, diapositive, schede di esercizi, un quiz del venerdì e una email ai genitori da rivedere.',
      },
      schools: {
        title: 'Per le scuole',
        text: 'Gli amministratori scolastici gestiscono utenti e ruoli; importazione in blocco di docenti e studenti.',
      },
    },
    featuresPage: {
      metaTitle: 'Funzionalità | TeacherHubPro',
      metaDescription:
        'Pianificazione delle lezioni, strumenti di IA, registro dei voti, presenze, presentazioni e un flusso di lavoro pensato per i docenti, in un unico spazio.',
      title: 'Funzionalità',
      intro: 'Cosa può fare oggi con TeacherHubPro.',
      learnMore: 'Scopra di più su {feature}',
      allFeatures: 'Tutte le funzionalità',
    },
    features: {
      'lesson-planning': {
        title: 'Pianificazione delle lezioni',
        description:
          "Piani di lezione settimanali con gli standard Common Core, abbozzati dall'IA e modificati da Lei.",
        intro: 'Pianifichi una settimana in pochi minuti e tenga tutti i piani in un unico posto.',
        p1Title: 'Piani settimanali e di inglese conversazionale',
        p1Text:
          'Obiettivi, competenze, standard e attività giorno per giorno, nel formato che i docenti già usano.',
        p2Title: "L'IA abbozza, Lei decide",
        p2Text:
          'Chieda una bozza per la Sua materia, classe e argomento; nulla viene salvato finché Lei non lo modifica e lo salva.',
        p3Title: 'Codici Common Core reali',
        p3Text:
          "Gli standard provengono dall'elenco ufficiale Common Core per la materia e la classe; i codici sono verificati, mai inventati.",
        p4Title: 'Modelli, cartelle e stampa',
        p4Text:
          'Salvi modelli, organizzi i piani in cartelle, duplichi una settimana, consulti un calendario e stampi o salvi in PDF.',
      },
      gradebook: {
        title: 'Registro dei voti e pagelle',
        description: 'Categorie ponderate, compiti, voti e pagelle in PDF.',
        intro: 'Voti che si sommano nel modo in cui li calcola la Sua scuola.',
        p1Title: 'Categorie ponderate',
        p1Text: 'Imposti categorie e pesi per ogni classe, oppure parta da quelli standard.',
        p2Title: 'Punti reali, medie reali',
        p2Text:
          'Ogni compito mantiene il proprio punteggio massimo e le medie usano i pesi delle categorie.',
        p3Title: 'Pagelle',
        p3Text:
          'Pagelle in PDF per semestre, con il logo della Sua scuola e i commenti del docente.',
        p4Title: 'Solo voti confermati',
        p4Text:
          "I voti suggeriti dall'IA restano bozze; le pagelle e le famiglie vedono solo i voti che Lei ha confermato.",
      },
      attendance: {
        title: 'Presenze',
        description:
          'Presenze giornaliere con presente, assente, in ritardo e giustificato, e report.',
        intro: "Registri le presenze in pochi secondi e osservi l'andamento nel tempo.",
        p1Title: 'Foglio giornaliero rapido',
        p1Text: 'Tutti partono come presenti; segni gli altri, con i minuti di ritardo e le note.',
        p2Title: 'Inviare e riaprire',
        p2Text: 'Un giorno inviato resta bloccato finché Lei non lo riapre.',
        p3Title: 'Report',
        p3Text: 'I conteggi e il tasso di presenza di ogni studente nei giorni che sceglie.',
        p4Title: 'Alimenta il Centro di controllo',
        p4Text:
          "Assenze e ritardi contano per l'elenco degli studenti a rischio nella Sua dashboard.",
      },
      'ai-tools': {
        title: 'Strumenti di IA',
        description:
          'Schede di esercizi, quiz, riassunti, attività, diapositive, giochi e suggerimenti di valutazione.',
        intro: "Un'IA che Le fa risparmiare tempo nelle bozze e lascia a Lei ogni decisione.",
        p1Title: 'Assistente IA',
        p1Text:
          'Schede di esercizi, quiz, riassunti di argomenti, attività e piani di lezione nella lingua che sceglie.',
        p2Title: 'Da PDF a verifica online',
        p2Text:
          "Carichi una verifica in PDF; l'IA la divide in domande che Lei rivede prima che gli studenti le vedano.",
        p3Title: 'Suggerimenti di valutazione',
        p3Text:
          "L'IA suggerisce punteggi e commenti per le risposte aperte; Lei conferma o modifica ciascuno.",
        p4Title: 'Ascolto',
        p4Text:
          'Faccia leggere il testo ad alta voce per gli studenti che imparano meglio ascoltando.',
      },
      presentations: {
        title: 'Presentazioni',
        description:
          "Diapositive abbozzate dall'IA, modificate, presentate, stampate o inviate a Google Classroom.",
        intro: 'Prepari in pochi minuti una presentazione per la lezione di domani.',
        p1Title: "Abbozzate dall'IA o partendo da zero",
        p1Text:
          'Indichi un argomento, una materia e una classe, oppure parta da una presentazione vuota.',
        p2Title: 'Layout e temi',
        p2Text: 'Layout con titolo, contenuto, due colonne e citazione, emoji, temi e transizioni.',
        p3Title: 'Presentare e stampare',
        p3Text: 'Presenti a schermo intero o stampi una diapositiva per pagina.',
        p4Title: 'Google Slides in Classroom',
        p4Text:
          'Invii una presentazione a un corso di Google Classroom come presentazione Google Slides consultabile dagli studenti.',
      },
      workflow: {
        title: 'Flusso di lavoro pensato per i docenti',
        description:
          "Classi, elenchi degli studenti, una dashboard giornaliera, Studente 360 e l'Agente di preparazione.",
        intro: 'Meno clic, più insegnamento.',
        p1Title: 'Classi ed elenchi degli studenti',
        p1Text: 'Classi con orari ed elenchi degli studenti da un file CSV o da Google Classroom.',
        p2Title: 'Centro di controllo',
        p2Text:
          'Le lezioni di oggi, cosa resta da valutare, gli studenti che potrebbero aver bisogno di aiuto e le prossime lezioni.',
        p3Title: 'Studente 360',
        p3Text:
          'La media di uno studente, le presenze, i compiti mancanti, una cronologia e le Sue note private.',
        p4Title: 'Agente di preparazione',
        p4Text:
          "Scriva una frase sulla prossima settimana e riveda un'intera settimana di bozze prima di pubblicarle.",
      },
    },
    ai: {
      metaTitle: 'Funzionalità di IA | TeacherHubPro',
      metaDescription:
        "Cosa abbozza l'IA di TeacherHubPro, cosa le viene inviato e perché decide sempre il docente.",
      title: 'IA che abbozza, docenti che decidono',
      intro:
        'Ogni funzionalità di IA in TeacherHubPro produce una bozza. Lei rivede, modifica e approva prima che qualcosa raggiunga studenti o famiglie.',
      listTitle: "Cosa può abbozzare l'IA",
      planner: 'Piani di lezione settimanali con codici Common Core',
      assistant: 'Schede di esercizi, quiz, riassunti e attività',
      slides: 'Diapositive di presentazione',
      extractor: 'Domande di verifiche online da un PDF',
      grader: 'Punteggi e commenti suggeriti per le risposte aperte',
      games: 'Contenuti di gioco per ogni modalità di gioco',
      paths: 'Lezioni dei percorsi di apprendimento con verifiche di comprensione',
      insight: "Una breve analisi dell'andamento di uno studente, basata solo su numeri",
      prep: "Una settimana di piani, diapositive, schede di esercizi, un quiz e un'email ai genitori",
      principlesTitle: "Come usiamo l'IA",
      principle1: "Ciò che produce l'IA è sempre una bozza finché un docente non lo approva.",
      principle2:
        "All'IA vengono inviati solo i campi necessari a un compito; i nomi degli studenti non vengono inviati quando non servono.",
      principle3: 'Prompt, lavori degli studenti e dati personali non vengono scritti nei log.',
      principle4: "L'IA scrive nella lingua scelta dal docente.",
      governance: "Legga la nostra pagina sulla governance dell'IA",
    },
    useCasesPage: {
      title: "Casi d'uso",
      intro: 'TeacherHubPro per il Suo modo di insegnare.',
    },
    useCases: {
      'classroom-teachers': {
        title: 'Docenti in classe',
        description: 'Piani, presenze, voti e famiglie per i docenti in classe.',
        intro:
          "Porti a termine la pianificazione e le pratiche burocratiche e dedichi le Sue energie all'insegnamento.",
        n1Title: 'Pianificare più in fretta',
        n1Text:
          "Piani settimanali, diapositive e schede di esercizi abbozzati dall'IA, pronti da adattare.",
        n2Title: 'Valutare con meno fatica',
        n2Text:
          "Verifiche online da un link, punteggio automatico per le domande chiuse, suggerimenti dell'IA per quelle aperte.",
        n3Title: 'Tenere informate le famiglie',
        n3Text: 'Link privati per le famiglie mostrano voti confermati e presenze.',
      },
      homeschool: {
        title: 'Famiglie con istruzione parentale',
        description:
          "Piani, registri, percorsi di apprendimento e progressi per le famiglie che praticano l'istruzione parentale.",
        intro: "Una struttura per l'istruzione parentale, senza lavoro inutile.",
        n1Title: 'Un piano per ogni settimana',
        n1Text: 'Piani settimanali con gli standard Common Core per ogni materia e classe.',
        n2Title: 'Registri da poter mostrare',
        n2Text: 'Presenze, voti e pagelle conservati in un unico posto.',
        n3Title: 'Imparare al proprio ritmo',
        n3Text:
          "Percorsi di apprendimento e giochi abbozzati dall'IA che i Suoi figli aprono da un link privato.",
      },
      tutors: {
        title: 'Tutor',
        description: 'Materiali, esercitazione e progressi per i tutor.',
        intro: 'Prepari le sessioni rapidamente e mostri i progressi con chiarezza.',
        n1Title: 'Materiali su richiesta',
        n1Text: 'Schede di esercizi, quiz e diapositive per qualsiasi argomento e livello.',
        n2Title: "Esercitazione tra una sessione e l'altra",
        n2Text:
          'Assegni verifiche, giochi e percorsi di apprendimento tramite link; non servono account per gli studenti.',
        n3Title: 'Progressi per i genitori',
        n3Text: 'Condivida un link per la famiglia, in sola lettura, con i risultati confermati.',
      },
      schools: {
        title: 'Scuole',
        description:
          'Un unico spazio per ogni docente, con pagine di amministrazione e importazione in blocco.',
        intro:
          'Dia a ogni docente gli stessi strumenti e mantenga i dati degli studenti in una sola scuola.',
        n1Title: 'Pagine di amministrazione',
        n1Text:
          'Gli amministratori scolastici vedono i propri utenti, cambiano i ruoli e passano le classi da un docente a un altro.',
        n2Title: 'Importazione in blocco',
        n2Text: 'Importi docenti ed elenchi degli studenti da fogli di calcolo.',
        n3Title: 'Piano Scuola',
        n3Text: 'Prezzo per docente con fatturazione annuale, a partire da 10 docenti.',
      },
    },
    pricingPage: {
      metaTitle: 'Prezzi | TeacherHubPro',
      metaDescription:
        'Piani Individuale, Scuola e Distretto, con una prova gratuita di 7 giorni senza bisogno di una carta di pagamento.',
      title: 'Prezzi',
      intro:
        'Ogni piano include tutte le funzionalità. Inizi con una prova gratuita di {days} giorni; non serve una carta di pagamento.',
      minimum: 'Da {count} docenti',
      start: 'Prova gratuita',
      contactSales: 'Ci contatti',
      faqTitle: 'Domande sui prezzi',
      faq1Q: 'Cosa succede quando termina la prova?',
      faq1A:
        "Conserva i Suoi dati. Per continuare a usare l'app, scelga un piano nella pagina Piani e fatturazione.",
      faq2Q: 'Come funzionano i piani Scuola e Distretto?',
      faq2A:
        'Si paga per docente, con fatturazione annuale: Scuola da 10 docenti, Distretto da 100.',
      faq3Q: 'Come pago?',
      faq3A:
        'I pagamenti sono gestiti da Stripe. TeacherHubPro non vede né conserva mai i numeri delle carte.',
    },
    integrationsPage: {
      metaTitle: 'Integrazioni | TeacherHubPro',
      metaDescription:
        'Accesso con Google, Google Classroom, Forms, Drive e Slides, Stripe ed email.',
      title: 'Integrazioni',
      intro: 'I servizi con cui TeacherHubPro funziona oggi, tramite le loro API ufficiali.',
      googleSignIn: 'Accesso con Google',
      googleSignInText: 'Si registri e acceda con il Suo account Google.',
      classroom: 'Google Classroom',
      classroomText:
        'Importi gli elenchi degli studenti, pubblichi compiti e documenti Word e invii presentazioni.',
      forms: 'Google Forms',
      formsText: 'Trasformi le domande di un compito in un quiz di Google Forms.',
      slides: 'Google Drive e Slides',
      slidesText: 'I documenti Word e le presentazioni vengono creati nel Suo Google Drive.',
      stripe: 'Stripe',
      stripeText:
        'Pagamenti sicuri per i piani; i dati delle carte non passano mai dai nostri server.',
      email: 'Email',
      emailText:
        'Link al portale per le famiglie, link per la password e aggiornamenti settimanali ai genitori via email.',
    },
    enterprisePage: {
      metaTitle: 'Scuole e distretti | TeacherHubPro',
      metaDescription:
        'TeacherHubPro per scuole e distretti: pagine di amministrazione, importazione in blocco e piani per docente.',
      title: 'Per scuole e distretti',
      intro:
        "Dia a ogni docente lo stesso spazio di lavoro, con i dati degli studenti conservati all'interno della Sua scuola.",
      p1Title: 'Pagine di amministrazione',
      p1Text:
        'Veda ogni utente della Sua scuola, cambi i ruoli, invii link per la password e trasferisca le classi.',
      p2Title: 'Importazione in blocco',
      p2Text:
        'Docenti ed elenchi degli studenti da file CSV, controllati riga per riga prima che venga creato qualsiasi elemento.',
      p3Title: 'Privacy fin dalla progettazione',
      p3Text:
        "Dati circoscritti alla scuola, link per studenti e famiglie conservati come hash, token Google cifrati e un'IA che si limita a preparare bozze.",
      p4Title: 'Piani per docente',
      p4Text: 'Scuola da 10 docenti e Distretto da 100, con fatturazione annuale.',
      cta: 'Ci parli della Sua scuola',
    },
    contactPage: {
      metaTitle: 'Contatti | TeacherHubPro',
      metaDescription:
        'Domande, una demo per la Sua scuola o assistenza: scriva al team di TeacherHubPro.',
      title: 'Ci contatti',
      intro:
        'Domande, una demo per la Sua scuola o assistenza con il Suo account: leggiamo ogni messaggio.',
      name: 'Il Suo nome',
      email: 'Email',
      organization: 'Scuola o organizzazione (facoltativo)',
      role: 'Sono',
      phone: 'Telefono (facoltativo)',
      interest: 'Mi interessa',
      message: 'Messaggio',
      consent: 'Usiamo questi dati solo per risponderLe. Non li vendiamo mai.',
      send: 'Invia',
      sent: 'Grazie. La ricontatteremo presto.',
    },
    roles: {
      teacher: 'Docente',
      homeschool: 'Famiglia con istruzione parentale',
      tutor: 'Tutor',
      school_admin: 'Amministratore scolastico',
      principal: 'Dirigente scolastico',
      district: 'Responsabile distrettuale',
      parent: 'Genitore',
      other: 'Altro',
    },
    interests: {
      features: 'Funzionalità',
      pricing: 'Prezzi',
      demo: 'Una demo',
      school: 'Un piano per la mia scuola',
      enterprise: 'Un piano per il distretto',
      support: 'Assistenza con il mio account',
      other: "Qualcos'altro",
    },
    helpPage: {
      metaTitle: 'Aiuto | TeacherHubPro',
      metaDescription: 'Inizi a usare TeacherHubPro e trovi le risposte alle domande più comuni.',
      title: 'Aiuto',
      intro: 'Inizi da qui, oppure ci scriva dalla pagina dei contatti.',
      startTitle: 'Per iniziare',
      step1: 'Si registri con la Sua email o con il Suo account Google.',
      step2:
        "Crei una classe e importi l'elenco degli studenti da un file CSV o da Google Classroom.",
      step3: 'Imposti le categorie di voto e registri le Sue prime presenze.',
      step4:
        "Chieda all'IA un piano settimanale, oppure all'Agente di preparazione un'intera settimana.",
      faqTitle: 'Domande frequenti',
      faq1Q: 'Come ricevono il lavoro gli studenti?',
      faq1A:
        'Da un compito Lei crea link privati per ogni studente; gli studenti li aprono senza un account.',
      faq2Q: 'Come vedono i progressi le famiglie?',
      faq2A:
        'Invii a ogni famiglia un link privato al portale, in sola lettura; mostra solo i voti che Lei ha confermato.',
      faq3Q: 'Ho dimenticato la password.',
      faq3A:
        'Usi «Password dimenticata?» nella pagina di accesso; Le invieremo via email un link monouso.',
      faq4Q: 'Come collego Google Classroom?',
      faq4A:
        'Apra Impostazioni e scelga Collega Google Classroom, poi selezioni il Suo account da docente.',
    },
    chat: {
      open: 'Chatta con Ed',
      close: 'Chiudi la chat',
      title: "Ed, l'assistente IA di TeacherHubPro",
      intro:
        'Salve! Sono Ed, un assistente IA. Posso rispondere a domande sulle funzionalità e sui prezzi di TeacherHubPro.',
      rolePrompt: 'Quale descrizione La rappresenta meglio?',
      interestPrompt: 'Su cosa vorrebbe informazioni?',
      placeholder: 'Scriva la Sua domanda',
      send: 'Invia',
      you: 'Lei',
      ed: 'Ed',
      thinking: 'Ed sta scrivendo…',
      failed:
        'Mi dispiace, non sono riuscito a rispondere. Riprovi oppure usi la pagina dei contatti.',
      limit:
        'Questa chat ha raggiunto il suo limite. Usi la pagina dei contatti per raggiungere il team.',
      leadPrompt: 'Desidera essere ricontattato dal team? Lasci i Suoi dati.',
      leadOpen: 'Lascia i miei dati',
      leadSent: 'Grazie! Il team La contatterà.',
      aiNote:
        "Le risposte provengono da un'IA e possono essere sbagliate; il riferimento sono i prezzi della pagina Prezzi.",
    },
    leads: {
      title: 'Contatti commerciali',
      intro:
        'Persone che hanno lasciato i propri dati nella chat del sito o nel modulo di contatto.',
      score_high: 'Alta',
      score_medium: 'Media',
      score_low: 'Bassa',
      source_chat: 'Chat',
      source_contact: 'Modulo di contatto',
      status_new: 'Nuovo',
      status_contacted: 'Contattato',
      status_closed: 'Chiuso',
      search: 'Cerca per nome, email o organizzazione',
      score: 'Priorità',
      source: 'Origine',
      status: 'Stato',
      all: 'Tutti',
      filter: 'Filtra',
      empty: 'Ancora nessun contatto.',
      received: 'Ricevuto',
      saveStatus: 'Salva stato',
      statusFor: 'Stato di {name}',
    },
  },
  legal: {
    updated: 'Ultimo aggiornamento: {date}',
    contact: 'Domande su questa pagina? Ci scriva dalla pagina dei contatti.',
    privacy: {
      title: 'Informativa sulla privacy',
      description: 'Quali dati conserva TeacherHubPro, perché e come sono protetti.',
      s1Title: 'A chi si applica',
      s1Text:
        "Questa informativa riguarda i docenti, il personale scolastico e i genitori che praticano l'istruzione parentale che usano TeacherHubPro, e le informazioni su studenti e famiglie che inseriscono. Studenti e famiglie non creano account; usano link privati forniti da un docente.",
      s2Title: 'Cosa conserviamo',
      s2Text:
        "Dati dell'account (nome, email, scuola, lingua), ciò che i docenti creano (classi, piani, compiti, voti, presenze, note) e ciò che gli studenti inviano tramite i propri link. I dati degli studenti contengono solo ciò che serve a una funzionalità: nomi, un numero di matricola facoltativo, un'email facoltativa di un genitore e adattamenti facoltativi.",
      s3Title: 'Come li usiamo',
      s3Text:
        'Solo per fornire il servizio alla scuola o al docente che li ha inseriti. Non vendiamo dati personali né usiamo i dati degli studenti per la pubblicità.',
      s4Title: 'Con chi li condividiamo',
      s4Text:
        "Fornitori di servizi che fanno funzionare l'app: il nostro fornitore di hosting e database, Stripe per i pagamenti, un fornitore di email per i messaggi, Anthropic (Claude) per le bozze dell'IA, OpenAI per l'audio di lettura ad alta voce e Google quando un docente collega Google Classroom. Ciascuno riceve solo ciò che serve al proprio compito.",
      s5Title: 'Come sono protetti',
      s5Text:
        'Le password sono conservate come hash unidirezionali. I link di sessione, per studenti, per famiglie e per la password sono casuali e conservati solo come hash. I token di Google Classroom sono cifrati. Ogni dato appartiene a una sola scuola ed è accessibile solo agli utenti di quella scuola.',
      s6Title: 'Conservazione e cancellazione dei dati',
      s6Text:
        "I dati restano finché l'account è attivo. I PDF caricati vengono eliminati una volta letti. Le chat del sito vengono eliminate dopo 30 giorni. Per chiedere una copia o la cancellazione dei Suoi dati, ci scriva dalla pagina dei contatti.",
    },
    terms: {
      title: "Condizioni d'uso",
      description: 'Le condizioni per usare TeacherHubPro.',
      s1Title: 'Il servizio',
      s1Text:
        "TeacherHubPro è un'app web per l'insegnamento: pianificazione, classi, presenze, voti, compiti, strumenti di IA per le bozze e portali per le famiglie.",
      s2Title: 'Il Suo account',
      s2Text:
        "Custodisca la Sua password, usi l'app per insegnare e imparare e rispetti le regole di uso accettabile. Lei è responsabile dei contenuti che crea e delle informazioni sugli studenti che inserisce, nonché di avere il diritto di inserirle.",
      s3Title: "Bozze dell'IA",
      s3Text:
        "Le funzionalità di IA producono bozze che possono contenere errori. Lei le rivede e le approva prima dell'uso; voti e report contano solo dopo che Lei li ha confermati.",
      s4Title: 'Piani e pagamento',
      s4Text:
        'I nuovi account ricevono una prova gratuita di 7 giorni. I piani a pagamento si rinnovano fino alla disdetta; i prezzi sono nella pagina Prezzi. I pagamenti sono elaborati da Stripe.',
      s5Title: 'I Suoi contenuti',
      s5Text:
        'Lei conserva i diritti su ciò che crea. Ci consente di conservarlo ed elaborarlo solo per fornirLe il servizio.',
      s6Title: 'Modifiche',
      s6Text:
        "Potremmo aggiornare queste condizioni; mostreremo la data dell'ultima versione in questa pagina.",
    },
    cookies: {
      title: 'Cookie',
      description: 'I cookie usati da TeacherHubPro.',
      s1Title: "Solo ciò che serve all'app",
      s1Text:
        'TeacherHubPro usa alcuni cookie per funzionare. Non usiamo cookie pubblicitari o di tracciamento.',
      s2Title: 'I cookie',
      s2Text:
        "thp_session La mantiene connesso (30 giorni). thp_oauth_state protegge l'accesso con Google e il collegamento a Classroom mentre avvengono. thp_tz ricorda il Suo fuso orario, così «oggi» è il Suo oggi. thp_tour_seen ricorda che ha chiuso la visita guidata di benvenuto.",
      s3Title: 'La chat del sito',
      s3Text:
        'La chat del sito conserva la chiave della conversazione solo nella scheda del Suo browser e termina quando chiude la scheda.',
    },
    accessibility: {
      title: 'Accessibilità',
      description: "Come TeacherHubPro lavora per l'accessibilità.",
      s1Title: 'Il nostro obiettivo',
      s1Text:
        'Puntiamo a far sì che TeacherHubPro soddisfi le WCAG 2 livello AA, affinché ogni docente, studente e famiglia possa usarlo.',
      s2Title: 'Cosa facciamo',
      s2Text:
        "Le pagine vengono testate automaticamente per i problemi WCAG 2 A e AA a ogni modifica. L'app funziona con la tastiera, usa moduli e intestazioni con etichette, segue la Sua impostazione chiara o scura e può leggere il testo ad alta voce.",
      s3Title: 'Ce lo segnali',
      s3Text:
        'Se qualcosa è difficile da usare, ci scriva dalla pagina dei contatti indicando la pagina e cosa è successo.',
    },
    acceptableUse: {
      title: 'Uso accettabile',
      description: 'Per cosa TeacherHubPro può e non può essere usato.',
      s1Title: "Lo usi per l'insegnamento",
      s1Text:
        'Usi TeacherHubPro per pianificare, insegnare, valutare e comunicare con le famiglie.',
      s2Title: 'Non è consentito',
      s2Text:
        "Non inserisca informazioni sugli studenti che non è autorizzato a condividere, non tenti di accedere ai dati di un'altra scuola, non condivida pubblicamente link privati di studenti o famiglie, non sovraccarichi né attacchi il servizio e non usi gli strumenti di IA per creare contenuti dannosi, illegali o estranei allo scopo.",
      s3Title: 'Se le regole vengono violate',
      s3Text: "Potremmo sospendere l'accesso che mette a rischio studenti, scuole o il servizio.",
    },
    ferpa: {
      title: 'FERPA',
      description: 'Come TeacherHubPro gestisce i registri scolastici.',
      s1Title: 'Registri scolastici',
      s1Text:
        'Voti, presenze, compiti e note inseriti dai docenti sono registri scolastici. Li trattiamo solo per fornire il servizio alla scuola o al docente, secondo le loro indicazioni.',
      s2Title: 'Accesso',
      s2Text:
        'I registri sono accessibili solo agli utenti della scuola a cui appartengono. Le famiglie vedono i voti confermati e le presenze del proprio figlio tramite un link privato.',
      s3Title: 'Nessun altro uso',
      s3Text: 'Non vendiamo i registri scolastici né li usiamo per la pubblicità.',
    },
    coppa: {
      title: 'Privacy dei minori (COPPA)',
      description: 'Come TeacherHubPro protegge le informazioni dei minori.',
      s1Title: 'Nessun account per gli studenti',
      s1Text:
        'Gli studenti non si registrano e non ci forniscono direttamente informazioni personali. Docenti, scuole e genitori inseriscono le informazioni di cui una funzionalità ha bisogno, e gli studenti usano link privati.',
      s2Title: 'Solo ciò che serve',
      s2Text:
        "Raccogliamo solo ciò che serve a una funzionalità, inviamo all'IA solo ciò che serve a un compito e non usiamo mai le informazioni dei minori per la pubblicità.",
      s3Title: 'Genitori',
      s3Text:
        'I genitori possono chiedere al docente o alla scuola del proprio figlio di rivedere o cancellare le informazioni del figlio, oppure scriverci dalla pagina dei contatti.',
    },
    aiGovernance: {
      title: "Governance dell'IA",
      description: 'Le regole seguite dalle funzionalità di IA di TeacherHubPro.',
      s1Title: 'Solo bozze',
      s1Text:
        "Voti dell'IA, analisi sugli studenti, piani, pacchetti di preparazione ed email ai genitori sono bozze finché un docente non li approva. Le pagelle, il totale del registro dei voti e i portali per le famiglie mostrano solo voti confermati dal docente.",
      s2Title: 'Dati minimi',
      s2Text:
        "A ogni compito dell'IA vengono inviati solo i campi necessari. Le analisi sugli studenti ricevono numeri e titoli dei compiti, non nomi. Prompt, lavori degli studenti e dati personali non vengono scritti nei log.",
      s3Title: 'Nessun fatto inventato',
      s3Text:
        "All'IA viene detto di non inventare voti, presenze, codici degli standard, prezzi o funzionalità, e le sue risposte vengono verificate: per esempio, i codici degli standard devono esistere e la chat del sito può indicare solo prezzi reali.",
      s4Title: "Trasparenza sull'IA",
      s4Text: 'La chat del sito è un assistente IA e lo dichiara quando viene chiesto.',
      s5Title: 'Fornitori',
      s5Text:
        "Le bozze dell'IA sono realizzate con Claude di Anthropic; l'audio di lettura ad alta voce con OpenAI.",
    },
    trust: {
      title: 'Centro fiducia',
      description: 'Come TeacherHubPro protegge scuole, docenti, studenti e famiglie.',
      s1Title: 'Pensato per i dati dei minori',
      s1Text:
        'Studenti e famiglie usano link privati invece di account. I link sono casuali, conservati solo come hash, revocabili e con scadenza.',
      s2Title: 'Ambito della scuola',
      s2Text:
        "Ogni dato appartiene a una sola scuola e ogni azione verifica la scuola e il ruolo dell'utente.",
      s3Title: 'Segreti e password',
      s3Text:
        'Le password sono conservate come hash; i token Google sono cifrati; i segreti non vengono mai scritti nei log; il codice viene analizzato a ogni modifica per individuare segreti esposti.',
      s4Title: 'IA con limiti',
      s4Text:
        "L'IA si limita a preparare bozze, riceve solo ciò che serve a un compito e viene controllata contro i fatti inventati. Consulti la pagina sulla governance dell'IA.",
      s5Title: 'Accordi',
      s5Text:
        'Le serve un accordo sul trattamento dei dati o ha una domanda sulla sicurezza per la Sua scuola? Ci scriva dalla pagina dei contatti.',
    },
  },
};
