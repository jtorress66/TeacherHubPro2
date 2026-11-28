import type { DemoMessages } from './marketing-types.ts';

// The product tour on /demo, in Italian.
export const demoIt: DemoMessages = {
  demo: {
    metaTitle: 'Demo di TeacherHubPro: scopra ogni funzione, passo dopo passo',
    metaDescription:
      'Una visita guidata di TeacherHubPro con schermate reali: piani di lezione, presenze, valutazione con l’IA, giochi, giochi dal vivo, portale per le famiglie e altro ancora.',
    title: 'Scopra TeacherHubPro, passo dopo passo',
    intro:
      'Una visita guidata di tutta l’app in {steps} passi, con schermate reali. Tutti gli studenti che vede sono inventati.',
    contents: 'Capitoli',
    chapterNumber: 'Capitolo {n}',
    enlarge: 'Apri la schermata a dimensione intera: {title}',
    madeUp:
      'Tutti i nomi, le classi e i voti in queste schermate sono inventati. Le bozze IA sono state scritte dall’IA dell’app e sono mostrate così come le ha scritte.',
    video: {
      introTitle: 'TeacherHubPro in due minuti',
      introLine:
        'Benvenuti in TeacherHubPro, lo spazio di lavoro con IA per insegnanti, scuole e famiglie che fanno istruzione parentale. Ecco in breve tutto quello che fa.',
      outroTitle: 'Provalo gratis per {days} giorni',
      outroLine: 'Prova TeacherHubPro gratis per {days} giorni, senza carta, su teacherhubpro.com.',
      madeUp: 'Tutti gli studenti mostrati sono inventati.',
    },
    chapters: {
      start: {
        title: 'Per iniziare',
        intro: 'Si registri in un minuto e inizi con una classe di esempio già pronta.',
      },
      classes: {
        title: 'Classi, elenchi e presenze',
        intro:
          'Importi i Suoi studenti da un foglio di calcolo e registri le presenze in pochi secondi.',
      },
      planning: {
        title: 'Pianificazione delle lezioni',
        intro:
          'Piani settimanali allineati al Common Core e agli standard di Porto Rico, pronti da stampare.',
      },
      assistant: {
        title: 'Assistente IA',
        intro:
          'Schede, quiz e rubriche preparati per la Sua classe e il Suo argomento. Lei modifica e decide.',
      },
      presentations: {
        title: 'Presentazioni',
        intro:
          'Slide preparate dall’IA, pronte da presentare o da aprire in Google Slides, Canva o OneDrive.',
      },
      prep: {
        title: 'Agente di preparazione',
        intro: 'Una frase diventa un’intera settimana, e Lei rivede tutto prima che venga inviato.',
      },
      assignments: {
        title: 'Compiti e valutazione con l’IA',
        intro:
          'Trasformi un PDF in un compito online, lo condivida con un link e confermi i voti suggeriti dall’IA.',
      },
      gradebook: {
        title: 'Registro dei voti e pagelle',
        intro: 'Categorie ponderate, semestri e pagelle, a partire dai voti che ha confermato.',
      },
      games: {
        title: 'Giochi educativi',
        intro:
          'Undici modalità di gioco, con una spiegazione per ogni risposta e il monitoraggio degli standard.',
      },
      live: {
        title: 'Giochi dal vivo in classe',
        intro: 'Giocate insieme sul grande schermo mentre gli studenti rispondono dal telefono.',
      },
      learning: {
        title: 'Apprendimento adattivo e analisi degli studenti',
        intro:
          'Percorsi di apprendimento personali e i primi segnali di chi potrebbe aver bisogno di aiuto.',
      },
      families: {
        title: 'Portale per le famiglie',
        intro:
          'Le famiglie vedono voti e presenze tramite un link privato, senza bisogno di un account.',
      },
      substitutes: {
        title: 'Pacchetti per i supplenti',
        intro: 'Tutto ciò che serve a un supplente, stampato con un clic.',
      },
      connections: {
        title: 'Strumenti collegati',
        intro: 'Funziona con Google, Microsoft, Canva e la piattaforma dei corsi della Sua scuola.',
      },
      schools: {
        title: 'Per scuole e distretti',
        intro:
          'Utilizzo, controlli, un registro delle decisioni dell’IA e i Suoi dati, tutto in un unico posto.',
      },
    },
    steps: {
      signup: {
        title: 'Crei il Suo account',
        text: 'Si registri con la Sua email o il Suo account Google. La prova gratuita inizia subito, senza carta di credito.',
        alt: 'La pagina di registrazione di TeacherHubPro con i campi nome, email e password.',
      },
      commandCenter: {
        title: 'Il Suo Centro di controllo',
        text: 'Ogni mattina vede le lezioni di oggi, i lavori da valutare e gli studenti che potrebbero aver bisogno di aiuto, tutto in un’unica schermata.',
        alt: 'Il Centro di controllo con le lezioni di oggi, i lavori da valutare e uno studente che potrebbe aver bisogno di aiuto.',
      },
      sampleClass: {
        title: 'Provi con una classe di esempio',
        text: 'Con un clic si aggiunge una classe di esempio con studenti, voti e presenze inventati, così può provare tutto prima di aggiungere le Sue classi. La rimuova quando vuole.',
        alt: 'La pagina della classe di esempio con sei studenti inventati.',
      },
      rosterImport: {
        title: 'Importi l’elenco della classe',
        text: 'Carichi un foglio di calcolo con nomi e cognomi. Numero dello studente, email dei genitori, adattamenti e lingua della famiglia sono colonne facoltative.',
        alt: 'L’elenco di una classe dopo l’importazione degli studenti da un foglio di calcolo.',
      },
      accommodations: {
        title: 'Gli adattamenti in un unico posto',
        text: 'Annoti una sola volta gli adattamenti di ogni studente. Compaiono dove servono, come nel pacchetto per il supplente, e restano riservati a Lei e alla Sua scuola.',
        alt: 'La scheda di modifica di uno studente con il campo degli adattamenti compilato.',
      },
      attendance: {
        title: 'Registri le presenze in pochi secondi',
        text: 'Segni presente, assente, in ritardo o giustificato per ogni studente, aggiunga i minuti di ritardo e salvi la giornata.',
        alt: 'Il foglio presenze con uno stato per ogni studente.',
      },
      attendanceReport: {
        title: 'Le presenze a colpo d’occhio',
        text: 'Il rapporto presenze mostra la percentuale di ogni studente e ogni assenza e ritardo nelle date che sceglie.',
        alt: 'Il rapporto presenze con la percentuale di presenza di ogni studente.',
      },
      planner: {
        title: 'Pianifichi la settimana con gli standard',
        text: 'Scriva il piano settimanale giorno per giorno e scelga gli standard dagli elenchi ufficiali del Common Core e di Porto Rico. L’app non inventa mai un codice di standard.',
        alt: 'Il pianificatore settimanale con il selettore degli standard di Porto Rico aperto.',
      },
      planPrint: {
        title: 'Stampi nel formato della Sua scuola',
        text: 'Stampi i piani nel formato classico con l’intestazione della Sua scuola, oppure in un semplice formato di una pagina.',
        alt: 'Un piano di lezione settimanale pronto da stampare nel formato classico.',
      },
      curriculum: {
        title: 'Aggiunga le Sue guide al curricolo',
        text: 'Carichi o incolli le programmazioni della Sua scuola. L’IA le segue quando prepara i piani, così le bozze corrispondono a ciò che la Sua scuola insegna.',
        alt: 'La pagina delle guide al curricolo con una programmazione pronta all’uso.',
      },
      templates: {
        title: 'Parta da un modello',
        text: 'Inizi un piano da un’unità già pronta o da uno dei Suoi modelli, poi cambi tutto ciò che vuole.',
        alt: 'La pagina dei modelli con unità già pronte.',
      },
      assistantForm: {
        title: 'Chieda all’assistente IA',
        text: 'Scelga una scheda, un quiz o un piano di lezione, poi materia, classe, argomento e lingua. Selezioni Supporto ESL per materiale al livello di chi impara l’inglese, secondo WIDA e gli standard di Porto Rico.',
        alt: 'Il modulo dell’assistente IA con tipo, argomento, classe e supporto ESL.',
      },
      assistantResult: {
        title: 'Riveda la bozza',
        text: 'La bozza è pronta in pochi secondi. La copi, la stampi, la faccia leggere ad alta voce, la apra in Canva o la salvi su OneDrive.',
        alt: 'Una scheda preparata dall’assistente IA.',
      },
      rubric: {
        title: 'Crei rubriche',
        text: 'Inizi una rubrica da zero o la faccia preparare all’IA, poi modifichi ogni criterio e livello. La usi per valutare le risposte scritte.',
        alt: 'Una rubrica con criteri e livelli, pronta da modificare.',
      },
      presentation: {
        title: 'Prepari una presentazione',
        text: 'Indichi un argomento e il numero di slide, scelga un tema e modifichi ogni slide prima di presentare.',
        alt: 'Una presentazione preparata dall’IA, aperta nell’editor di slide.',
      },
      presentationExport: {
        title: 'La presenti ovunque',
        text: 'Presenti dal browser, scarichi il PowerPoint, la invii a Google Classroom e Slides, la apra in Canva o la salvi su OneDrive.',
        alt: 'Le opzioni di una presentazione per inviarla a Google Classroom, Canva e OneDrive.',
      },
      prepStart: {
        title: 'Una frase, un’intera settimana',
        text: 'Scriva cosa insegna questa settimana. L’Agente di preparazione prepara il piano, le slide e le schede per ogni giorno, un quiz per venerdì e una nota per le famiglie.',
        alt: 'Il modulo dell’Agente di preparazione con una frase che descrive la settimana.',
      },
      prepReview: {
        title: 'Lei rivede prima che parta qualsiasi cosa',
        text: 'Legga ogni elemento, lo tenga o lo scarti, e modifichi l’email alle famiglie. Nulla viene pubblicato o inviato finché non lo decide Lei.',
        alt: 'La revisione dell’Agente di preparazione con il piano della settimana, le schede, il quiz e l’email alle famiglie.',
      },
      pdfImport: {
        title: 'Trasformi un PDF in un compito online',
        text: 'Carichi una scheda o una verifica in PDF. L’IA ne legge le domande in un editor dove Lei controlla ognuna prima di salvare.',
        alt: 'Domande importate da un PDF, pronte da controllare e salvare.',
      },
      studentLinks: {
        title: 'Condivida con i link degli studenti',
        text: 'Ogni studente riceve un link privato: nessun account né password da gestire. Può sostituire o disattivare un link in qualsiasi momento.',
        alt: 'La pagina dei link degli studenti con un link per ogni studente.',
      },
      studentAnswer: {
        title: 'Gli studenti rispondono da qualsiasi dispositivo',
        text: 'Gli studenti aprono il loro link su telefono, tablet o computer, rispondono e consegnano. Le domande possono essere lette ad alta voce.',
        alt: 'Uno studente che risponde a un compito dal telefono.',
      },
      aiGrading: {
        title: 'L’IA suggerisce, Lei decide',
        text: 'Le domande a scelta si correggono da sole. Per le risposte scritte l’IA suggerisce un punteggio e un commento, e nulla conta finché Lei non lo conferma o lo modifica.',
        alt: 'La risposta di uno studente con un punteggio suggerito dall’IA in attesa della conferma dell’insegnante.',
      },
      gradebook: {
        title: 'Un registro dei voti che fa i conti',
        text: 'Categorie ponderate, il voto complessivo di ogni studente e solo i voti che ha confermato.',
        alt: 'Il registro dei voti con le categorie e il voto complessivo di ogni studente.',
      },
      reportCards: {
        title: 'Pagelle in pochi minuti',
        text: 'Aggiunga un commento per ogni studente e scarichi le pagelle in PDF, una alla volta o per tutta la classe.',
        alt: 'Pagelle con i voti per categoria e il commento dell’insegnante.',
      },
      gameBuilder: {
        title: 'Crei un gioco in pochi minuti',
        text: 'Scriva le Sue domande o le faccia preparare all’IA, poi scelga tra undici modalità come Quiz, Contro il tempo, Abbinamenti, Memory e Cruciverba.',
        alt: 'L’editor dei giochi con le carte delle domande.',
      },
      gameReview: {
        title: 'Gli studenti capiscono il perché',
        text: 'Dopo un round, gli studenti rivedono le domande sbagliate con la risposta giusta e una breve spiegazione del perché.',
        alt: 'La revisione di uno studente dopo un gioco, con le risposte giuste e le spiegazioni.',
      },
      aiExplanations: {
        title: 'Spiegazioni scritte per Lei',
        text: 'Con un clic chiede all’IA di scrivere un breve “perché” per ogni carta che non ne ha. Lei le legge e le modifica prima di salvare.',
        alt: 'Spiegazioni scritte dall’IA, pronte per la revisione dell’insegnante.',
      },
      coverage: {
        title: 'Veda quali standard ha trattato',
        text: 'Il rapporto di copertura mostra i risultati della classe su ogni standard che ha indicato, con un clic per riprendere ciò che richiede più lavoro.',
        alt: 'Il rapporto di copertura degli standard di una classe.',
      },
      liveLobby: {
        title: 'Avvii un gioco dal vivo',
        text: 'Proietti il gioco sul grande schermo. Gli studenti entrano con un PIN di 6 cifre e toccano il proprio nome nel Suo elenco.',
        alt: 'La sala d’attesa del gioco dal vivo con il PIN e gli studenti che sono entrati.',
      },
      livePlayer: {
        title: 'Gli studenti giocano dal telefono',
        text: 'Ogni studente risponde dal proprio dispositivo, contro il tempo, con punti per la velocità e le serie di risposte giuste.',
        alt: 'Uno studente che risponde a una domanda di un gioco dal vivo dal telefono.',
      },
      liveReveal: {
        title: 'Svelare, spiegare, andare avanti',
        text: 'Dopo ogni domanda il grande schermo mostra la risposta giusta, come ha risposto la classe e perché, poi la classifica.',
        alt: 'Il grande schermo con la risposta giusta, le risposte della classe e la spiegazione.',
      },
      learningPath: {
        title: 'Percorsi di apprendimento personali',
        text: 'Prepari una breve serie di lezioni per uno studente sull’argomento di cui ha bisogno. Lei la modifica, poi la assegna al suo link.',
        alt: 'Un percorso di apprendimento preparato per uno studente, aperto nell’editor.',
      },
      studentLesson: {
        title: 'Lezioni al ritmo di ogni studente',
        text: 'Lo studente legge ogni lezione, risponde a una breve verifica e vede il suo punteggio. Lei vede i suoi progressi.',
        alt: 'Uno studente che segue una lezione dal telefono.',
      },
      insights: {
        title: 'Sappia chi potrebbe aver bisogno di aiuto',
        text: 'La pagina di ogni studente riunisce voti, presenze e note. Un riepilogo dell’IA suggerisce i prossimi passi da valutare.',
        alt: 'La pagina di uno studente con voti, presenze e un riepilogo dell’IA.',
      },
      parentPortal: {
        title: 'Tenga informate le famiglie',
        text: 'Le famiglie aprono un link privato per vedere i voti confermati e le presenze. Le note settimanali dell’Agente di preparazione possono arrivare a ogni famiglia nella sua lingua.',
        alt: 'Il portale per le famiglie su un telefono con voti e presenze.',
      },
      subPacket: {
        title: 'Sia pronto per un supplente',
        text: 'Il pacchetto per il supplente raccoglie orario, elenco della classe, piani, routine e contatti, pronto da stampare.',
        alt: 'Un pacchetto per il supplente con orario, elenco della classe e routine.',
      },
      integrations: {
        title: 'Colleghi i Suoi strumenti',
        text: 'Colleghi Google Classroom, Google Drive, Microsoft OneDrive e Teams, Canva e il Suo calendario. Sceglie Lei cosa condividere, uno strumento alla volta.',
        alt: 'La pagina Strumenti collegati con Google, Microsoft e Canva.',
      },
      schoolSystems: {
        title: 'La piattaforma dei corsi della Sua scuola',
        text: 'Le scuole possono aprire TeacherHubPro dentro Canvas, Schoology, Moodle e D2L Brightspace e rimandare i voti confermati, tramite lo standard LTI 1.3. Disponibile su richiesta.',
        alt: 'La sezione dei sistemi scolastici in Strumenti collegati.',
      },
      schoolOverview: {
        title: 'La panoramica della scuola',
        text: 'I dirigenti scolastici vedono come ogni insegnante usa l’app e possono attivare o disattivare per la scuola le funzioni IA e le segnalazioni sugli studenti.',
        alt: 'La panoramica della scuola con l’utilizzo per insegnante e le impostazioni per tutta la scuola.',
      },
      schoolUsers: {
        title: 'Gestisca gli utenti della scuola',
        text: 'Assegni a insegnanti e amministratori il ruolo giusto e passi una classe a un altro insegnante quando qualcuno lascia la scuola.',
        alt: 'La pagina degli utenti della scuola con i ruoli.',
      },
      approvals: {
        title: 'Un registro di ogni decisione dell’IA',
        text: 'Il lavoro dell’IA arriva a studenti e famiglie solo dopo l’approvazione di un insegnante. Il registro delle approvazioni mostra chi ha approvato cosa e quando, senza nomi né voti degli studenti.',
        alt: 'Il registro delle approvazioni con ciò che gli insegnanti hanno approvato.',
      },
      dataExport: {
        title: 'I Suoi dati restano Suoi',
        text: 'Scarichi tutti i dati della Sua scuola in qualsiasi momento, oppure elimini Lei stesso la scuola e i suoi dati.',
        alt: 'La pagina delle impostazioni con il download e l’eliminazione dei dati della scuola.',
      },
      languages: {
        title: 'Sette lingue',
        text: 'Usi l’app in inglese, spagnolo, francese, portoghese, tedesco, italiano o cinese. L’IA scrive nella lingua che sceglie.',
        alt: 'La pagina delle impostazioni con la scelta della lingua.',
      },
    },
  },
};
