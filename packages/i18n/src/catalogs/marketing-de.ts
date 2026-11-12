import type { MarketingMessages } from './marketing-types.ts';

// Der Text der öffentlichen Website auf Deutsch: Marketingseiten, der Website-Chat und die
// Rechtsseiten. Alles, was er sagt, muss heute auf die App zutreffen.

export const marketingDe: MarketingMessages = {
  marketing: {
    nav: {
      label: 'Hauptmenü',
      features: 'Funktionen',
      useCases: 'Anwendungsfälle',
      pricing: 'Preise',
      contact: 'Kontakt',
      logIn: 'Anmelden',
      startTrial: 'Kostenlos testen',
    },
    footer: {
      tagline:
        'Der KI-Arbeitsbereich für den Unterricht – für Lehrkräfte, Schulen und Familien mit Homeschooling.',
      product: 'Produkt',
      useCases: 'Anwendungsfälle',
      company: 'Unternehmen',
      legal: 'Rechtliches und Vertrauen',
      ai: 'KI-Funktionen',
      integrations: 'Integrationen',
      enterprise: 'Schulen und Bezirke',
      help: 'Hilfe',
      rights: '© {year} TeacherHubPro',
    },
    landing: {
      metaTitle: 'TeacherHubPro: Ihr KI-Arbeitsbereich für den Unterricht',
      metaDescription:
        'Planen Sie Unterricht, erfassen Sie die Anwesenheit, bewerten Sie, erstellen Sie Folien, Spiele und Quizze und teilen Sie Fortschritte mit Familien – die KI entwirft, Sie entscheiden. 7 Tage kostenlos testen.',
      featuresTitle: 'Alles, was eine Unterrichtswoche braucht',
      featuresIntro: 'Ein Arbeitsbereich für Planung, Unterricht, Bewertung und Familien.',
      howTitle: 'So funktioniert es',
      how1Title: 'Richten Sie Ihre Klassen ein',
      how1Text:
        'Legen Sie eine Klasse an und importieren Sie Ihre Klassenliste aus einer Tabelle oder aus Google Classroom.',
      how2Title: 'Lassen Sie die KI entwerfen',
      how2Text:
        'Fordern Sie einen Wochenplan, Folien, ein Arbeitsblatt, ein Quiz oder die Vorbereitung einer ganzen Woche an. Jedes Ergebnis ist ein Entwurf.',
      how3Title: 'Prüfen und verwenden',
      how3Text:
        'Bearbeiten Sie alles; dann unterrichten Sie, weisen zu, bewerten und teilen. Nichts erreicht Schülerinnen und Schüler oder Familien, bevor Sie es freigeben.',
      whoTitle: 'Gemacht für',
      whoIntro:
        'Lehrkräfte im Klassenzimmer, Homeschooling-Familien, Nachhilfelehrkräfte und ganze Schulen.',
      trustTitle: 'Schülerdaten, sorgfältig behandelt',
      trustIntro:
        'Schülerinnen und Schüler sind minderjährig, und die App ist darauf ausgerichtet.',
      trust1:
        'Schülerinnen, Schüler und Eltern nutzen private Links statt Konten. Die Links sind zufällig, werden nur als Hashes gespeichert und können widerrufen werden.',
      trust2:
        'Jeder Datensatz gehört zu genau einer Schule, und nur die Lehrkräfte dieser Schule können darauf zugreifen.',
      trust3:
        'Die KI erhält nur, was eine Aufgabe braucht. Schüleranalysen erhalten Zahlen, niemals einen Namen.',
      trust4: 'KI-Noten und -Vorschläge bleiben Entwürfe, bis eine Lehrkraft sie bestätigt.',
      trustMore: 'Zum Trust Center',
      pricingTitle: 'Einfache Preise',
      pricingIntro:
        'Beginnen Sie mit einer kostenlosen {days}-tägigen Testphase. Keine Zahlungskarte nötig.',
      pricingSee: 'Alle Tarife ansehen',
      faqTitle: 'Fragen',
      faq1Q: 'Brauche ich für die Testphase eine Zahlungskarte?',
      faq1A:
        'Nein. Die Testphase gibt Ihnen 7 Tage lang vollen Zugriff; einen Tarif wählen Sie nur, wenn Sie weitermachen möchten.',
      faq2Q: 'Bewertet die KI für mich?',
      faq2A:
        'Sie schlägt Punktzahlen und Feedback für offene Antworten vor. Sie bestätigen jede Note, bevor sie zählt.',
      faq3Q: 'Welche Sprachen werden unterstützt?',
      faq3A:
        'Die App ist vollständig auf Englisch und Spanisch verfügbar, und die KI schreibt in der Sprache Ihrer Wahl. Französisch, Portugiesisch, Deutsch, Italienisch und Chinesisch sind teilweise übersetzt.',
      faq4Q: 'Funktioniert es mit Google Classroom?',
      faq4A:
        'Ja. Sie können Klassenlisten importieren, Aufgaben und Word-Dokumente veröffentlichen, Präsentationen als Google Slides senden und Google-Forms-Quizze erstellen.',
      faq5Q: 'Kann meine ganze Schule es nutzen?',
      faq5A:
        'Ja. Mit den Tarifen „Schule“ und „Bezirk“ fügen Sie einer Schule Lehrkräfte hinzu, mit Verwaltungsseiten und Massenimport.',
      ctaTitle: 'Probieren Sie es mit Ihren eigenen Klassen aus',
      ctaText:
        'Richten Sie in wenigen Minuten eine Klasse ein und lassen Sie die KI Ihre nächste Woche entwerfen.',
    },
    feature: {
      lesson_planner: {
        title: 'Unterrichtsplaner',
        text: 'Wochenpläne mit Common-Core-Standards, von der KI entworfen und von Ihnen bearbeitet.',
      },
      ai_assistant: {
        title: 'KI-Assistent',
        text: 'Arbeitsblätter, Quizze, Zusammenfassungen und Aktivitäten in Ihrer Sprache.',
      },
      presentations: {
        title: 'Präsentationen',
        text: 'Von der KI entworfene Folien, im Vollbild präsentiert, gedruckt oder an Google Classroom gesendet.',
      },
      gradebook: {
        title: 'Notenbuch und Zeugnisse',
        text: 'Gewichtete Kategorien, Aufgaben und Zeugnisse als PDF mit dem Logo Ihrer Schule.',
      },
      attendance: {
        title: 'Anwesenheit',
        text: 'Tägliche Anwesenheit mit Verspätungen, entschuldigten Tagen und Berichten.',
      },
      assignments: {
        title: 'Online-Tests und KI-Bewertung',
        text: 'Erstellen Sie Fragen oder importieren Sie einen PDF-Test; Schülerinnen und Schüler antworten über einen Link; Sie bestätigen die von der KI vorgeschlagenen Noten.',
      },
      games: {
        title: 'Spiele und Live-Spiele',
        text: 'Lernspiele in vielen Modi und Live-Klassenspiele, denen Schülerinnen und Schüler mit einer PIN beitreten.',
      },
      learning: {
        title: 'Lernpfade',
        text: 'Von der KI entworfene Lektionen mit Lernkontrollen, über private Links an Schülerinnen und Schüler zugewiesen.',
      },
      families: {
        title: 'Familienportal',
        text: 'Jede Familie erhält einen privaten Link mit Lesezugriff auf bestätigte Noten und die Anwesenheit.',
      },
      command_center: {
        title: 'Kommandozentrale',
        text: 'Die heutigen Klassen, was zu bewerten ist, Schülerinnen und Schüler, die Hilfe brauchen könnten, und Vorschläge.',
      },
      prep_agent: {
        title: 'Vorbereitungsagent',
        text: 'Aus einem Satz wird eine Woche: Plan, Folien, Arbeitsblätter, ein Freitagsquiz und eine Elternmail zur Prüfung.',
      },
      schools: {
        title: 'Für Schulen',
        text: 'Schuladministratoren verwalten Benutzer und Rollen; Massenimport von Lehrkräften und Schülerinnen und Schülern.',
      },
    },
    featuresPage: {
      metaTitle: 'Funktionen | TeacherHubPro',
      metaDescription:
        'Unterrichtsplanung, KI-Werkzeuge, Notenbuch, Anwesenheit, Präsentationen und ein lehrkraftfreundlicher Arbeitsablauf in einem Arbeitsbereich.',
      title: 'Funktionen',
      intro: 'Was Sie heute mit TeacherHubPro tun können.',
      learnMore: 'Mehr erfahren über {feature}',
      allFeatures: 'Alle Funktionen',
    },
    included: {
      title: 'Alles inklusive',
      intro: 'Alle Funktionen, die TeacherHubPro heute hat, in einer Liste.',
      prepAgent:
        'Vorbereitungsagent: Aus einem Satz wird eine Woche mit Unterrichtsplänen, Folien, Arbeitsblättern, einem Freitagsquiz und einer Elternmail, bereit zur Durchsicht',
      planner:
        'KI-Unterrichtsplaner mit Common-Core- und Puerto-Rico-Standards, im einfachen oder klassischen Layout',
      assistant:
        'KI-Assistent für Arbeitsblätter, Quizze, Zusammenfassungen und Aktivitäten, mit Unterstützung für Englischlernende (ESL)',
      presentations:
        'KI-Präsentationen im Vollbild zeigen, drucken, als PowerPoint herunterladen oder an Google Classroom senden',
      tests:
        'Online-Tests, die Schüler über einen privaten Link beantworten; Fragen selbst schreiben oder einen PDF-Test importieren',
      aiGrading: 'KI-Bewertung offener Antworten als Vorschläge, die die Lehrkraft bestätigt',
      gradebook: 'Gewichtetes Notenbuch und Zeugnisse als PDF mit dem Logo Ihrer Schule',
      attendance: 'Tägliche Anwesenheit mit Verspätungen, entschuldigten Fehlzeiten und Berichten',
      games:
        'Lernspiele in vielen Modi und Live-Spiele im Klassenzimmer, denen Schüler mit einer PIN beitreten',
      learning:
        'Lernpfade: von der KI entworfene Lektionen mit Lernkontrollen, über private Schülerlinks zugewiesen',
      families:
        'Elternportal: ein privater Link nur zum Lesen mit bestätigten Noten und Anwesenheit, dazu wöchentliche Updates per E-Mail',
      commandCenter:
        'Kommandozentrale: die heutigen Stunden, was zu bewerten ist und welche Schüler Hilfe brauchen könnten',
      subPacket: 'Mappen für Vertretungslehrkräfte',
      listen: 'Anhören: Pläne und Materialien vorgelesen',
      google:
        'Google-Integration: Anmeldung mit Google, Google Classroom (Klassenlisten importieren, Aufgaben, Word-Dokumente und Präsentationen posten), Google-Forms-Quizze und Dateien in Ihrem eigenen Google Drive',
      canva:
        'Canva: Präsentationen und Arbeitsblätter im eigenen Canva-Konto als bearbeitbare Designs öffnen',
      microsoft:
        'Microsoft OneDrive: Präsentationen als PowerPoint und Arbeitsblätter als Word-Dateien im eigenen OneDrive speichern',
      teams:
        'Microsoft Teams für Schulen, die Teams im Unterricht nutzen: auf Anfrage Klassenlisten aus einer Teams-Klasse importieren und Aufgaben mit ihr teilen. Die IT-Administration Ihrer Schule genehmigt die Verbindung einmalig.',
      languages:
        'Sieben Sprachen: Englisch, Spanisch, Französisch, Portugiesisch, Deutsch, Italienisch und Chinesisch; die KI schreibt in der gewählten Sprache',
      privacy:
        'Keine Schüler- oder Elternkonten: private Links, nur als Hash gespeichert, widerrufbar und mit Ablaufdatum; entwickelt für FERPA und COPPA',
      aiDrafts:
        'Die KI schlägt vor, die Lehrkraft entscheidet: Noten, Einblicke und Elternmails bleiben Entwürfe, bis Sie sie freigeben',
      schools:
        'Für Schulen und Bezirke: Verwaltungsseiten, Rollen und Massenimport von Lehrkräften und Schülern',
      audiences: 'Für Lehrkräfte, Schulen, Nachhilfelehrer und Familien mit Homeschooling',
    },
    features: {
      'lesson-planning': {
        title: 'Unterrichtsplanung',
        description:
          'Wöchentliche Unterrichtspläne mit Common-Core-Standards, von der KI entworfen und von Ihnen bearbeitet.',
        intro: 'Planen Sie eine Woche in Minuten und behalten Sie alle Pläne an einem Ort.',
        p1Title: 'Wochenpläne und Pläne für Conversational English',
        p1Text:
          'Lernziele, Kompetenzen, Standards und Aktivitäten Tag für Tag, im Format, das Lehrkräfte bereits verwenden.',
        p2Title: 'Die KI entwirft, Sie entscheiden',
        p2Text:
          'Fordern Sie einen Entwurf für Ihr Fach, Ihre Klassenstufe und Ihr Thema an; nichts wird gespeichert, bis Sie es bearbeiten und speichern.',
        p3Title: 'Echte Common-Core-Codes',
        p3Text:
          'Die Standards stammen aus der offiziellen Common-Core-Liste für Fach und Klassenstufe; die Codes werden geprüft, nie erfunden.',
        p4Title: 'Vorlagen, Ordner und Drucken',
        p4Text:
          'Speichern Sie Vorlagen, ordnen Sie Pläne in Ordnern, duplizieren Sie eine Woche, sehen Sie einen Kalender und drucken Sie oder speichern Sie als PDF.',
      },
      gradebook: {
        title: 'Notenbuch und Zeugnisse',
        description: 'Gewichtete Kategorien, Aufgaben, Noten und Zeugnisse als PDF.',
        intro: 'Noten, die so zusammengerechnet werden, wie Ihre Schule sie zählt.',
        p1Title: 'Gewichtete Kategorien',
        p1Text:
          'Legen Sie Kategorien und Gewichtungen pro Klasse fest, oder beginnen Sie mit den Standardkategorien.',
        p2Title: 'Echte Punkte, echte Durchschnitte',
        p2Text:
          'Jede Aufgabe behält ihre eigene Höchstpunktzahl, und die Durchschnitte verwenden die Gewichtungen der Kategorien.',
        p3Title: 'Zeugnisse',
        p3Text:
          'Zeugnisse als PDF pro Semester, mit dem Logo Ihrer Schule und Kommentaren der Lehrkraft.',
        p4Title: 'Nur bestätigte Noten',
        p4Text:
          'Von der KI vorgeschlagene Noten bleiben Entwürfe; Zeugnisse und Familien sehen nur Noten, die Sie bestätigt haben.',
      },
      attendance: {
        title: 'Anwesenheit',
        description:
          'Tägliche Anwesenheit mit anwesend, abwesend, verspätet und entschuldigt, sowie Berichte.',
        intro: 'Erfassen Sie die Anwesenheit in Sekunden und erkennen Sie Muster im Zeitverlauf.',
        p1Title: 'Schnelle Tagesliste',
        p1Text:
          'Alle beginnen als anwesend; markieren Sie den Rest, mit Minuten der Verspätung und Notizen.',
        p2Title: 'Abschicken und wieder öffnen',
        p2Text: 'Ein abgeschickter Tag ist gesperrt, bis Sie ihn wieder öffnen.',
        p3Title: 'Berichte',
        p3Text:
          'Die Zählungen und die Anwesenheitsquote jedes Schülers bzw. jeder Schülerin über die von Ihnen gewählten Tage.',
        p4Title: 'Speist die Kommandozentrale',
        p4Text:
          'Fehltage und Verspätungen zählen für die Liste gefährdeter Schülerinnen und Schüler auf Ihrem Dashboard.',
      },
      'ai-tools': {
        title: 'KI-Werkzeuge',
        description:
          'Arbeitsblätter, Quizze, Zusammenfassungen, Aktivitäten, Folien, Spiele und Bewertungsvorschläge.',
        intro: 'KI, die Ihnen Zeit beim Entwerfen spart und jede Entscheidung Ihnen überlässt.',
        p1Title: 'KI-Assistent',
        p1Text:
          'Arbeitsblätter, Quizze, Themenzusammenfassungen, Aktivitäten und Unterrichtspläne in der Sprache Ihrer Wahl.',
        p2Title: 'Vom PDF zum Online-Test',
        p2Text:
          'Laden Sie einen Test als PDF hoch; die KI teilt ihn in Fragen auf, die Sie prüfen, bevor Schülerinnen und Schüler sie sehen.',
        p3Title: 'Bewertungsvorschläge',
        p3Text:
          'Die KI schlägt Punktzahlen und Feedback für offene Antworten vor; Sie bestätigen oder ändern jeden Vorschlag.',
        p4Title: 'Anhören',
        p4Text:
          'Lassen Sie Texte vorlesen, für Schülerinnen und Schüler, die besser durch Zuhören lernen.',
      },
      presentations: {
        title: 'Präsentationen',
        description:
          'Von der KI entworfene Folien, bearbeitet, präsentiert, gedruckt oder an Google Classroom gesendet.',
        intro: 'Erstellen Sie in wenigen Minuten einen Foliensatz für die Stunde von morgen.',
        p1Title: 'Von der KI entworfen oder leer begonnen',
        p1Text:
          'Geben Sie Thema, Fach und Klassenstufe an, oder beginnen Sie mit einem leeren Foliensatz.',
        p2Title: 'Layouts und Designs',
        p2Text: 'Layouts für Titel, Inhalt, zwei Spalten und Zitat, Emojis, Designs und Übergänge.',
        p3Title: 'Präsentieren und drucken',
        p3Text: 'Präsentieren Sie im Vollbild, oder drucken Sie eine Folie pro Seite.',
        p4Title: 'Google Slides in Classroom',
        p4Text:
          'Senden Sie eine Präsentation als Google-Slides-Foliensatz, den Schülerinnen und Schüler ansehen können, an einen Google-Classroom-Kurs.',
      },
      workflow: {
        title: 'Lehrkraftfreundlicher Arbeitsablauf',
        description:
          'Klassen, Klassenlisten, ein tägliches Dashboard, Schüler 360 und der Vorbereitungsagent.',
        intro: 'Weniger Klicken, mehr Unterrichten.',
        p1Title: 'Klassen und Klassenlisten',
        p1Text:
          'Klassen mit Stundenplänen, und Klassenlisten aus einer CSV-Datei oder Google Classroom.',
        p2Title: 'Kommandozentrale',
        p2Text:
          'Die heutigen Klassen, was noch zu bewerten ist, Schülerinnen und Schüler, die Hilfe brauchen könnten, und anstehende Stunden.',
        p3Title: 'Schüler 360',
        p3Text:
          'Der Durchschnitt eines Schülers bzw. einer Schülerin, die Anwesenheit, fehlende Arbeiten, eine Zeitleiste und Ihre privaten Notizen.',
        p4Title: 'Vorbereitungsagent',
        p4Text:
          'Schreiben Sie einen Satz über die nächste Woche und prüfen Sie eine ganze Woche an Entwürfen, bevor Sie veröffentlichen.',
      },
    },
    ai: {
      metaTitle: 'KI-Funktionen | TeacherHubPro',
      metaDescription:
        'Was die KI von TeacherHubPro entwirft, was sie erhält und warum immer die Lehrkraft entscheidet.',
      title: 'Die KI entwirft, Lehrkräfte entscheiden',
      intro:
        'Jede KI-Funktion in TeacherHubPro erstellt einen Entwurf. Sie prüfen, bearbeiten und geben frei, bevor irgendetwas Schülerinnen und Schüler oder Familien erreicht.',
      listTitle: 'Was die KI entwerfen kann',
      planner: 'Wöchentliche Unterrichtspläne mit Common-Core-Codes',
      assistant: 'Arbeitsblätter, Quizze, Zusammenfassungen und Aktivitäten',
      slides: 'Präsentationsfolien',
      extractor: 'Fragen für Online-Tests aus einem PDF',
      grader: 'Vorgeschlagene Punktzahlen und Feedback für offene Antworten',
      games: 'Spielinhalte für jeden Spielmodus',
      paths: 'Lektionen für Lernpfade mit Lernkontrollen',
      insight:
        'Eine kurze Einschätzung zu den Entwicklungen eines Schülers bzw. einer Schülerin, nur anhand von Zahlen',
      prep: 'Eine Woche mit Plänen, Folien, Arbeitsblättern, einem Quiz und einer Elternmail',
      principlesTitle: 'Wie wir KI einsetzen',
      principle1: 'KI-Ergebnisse sind immer Entwürfe, bis eine Lehrkraft sie freigibt.',
      principle2:
        'Die KI erhält nur die Felder, die eine Aufgabe braucht; Namen von Schülerinnen und Schülern werden nicht gesendet, wenn sie nicht nötig sind.',
      principle3:
        'Prompts, Schülerarbeiten und personenbezogene Daten werden nicht in Logs geschrieben.',
      principle4: 'Die KI schreibt in der Sprache, die die Lehrkraft wählt.',
      governance: 'Lesen Sie unsere Seite zur KI-Governance',
    },
    useCasesPage: {
      title: 'Anwendungsfälle',
      intro: 'TeacherHubPro für die Art, wie Sie unterrichten.',
    },
    useCases: {
      'classroom-teachers': {
        title: 'Lehrkräfte im Klassenzimmer',
        description: 'Pläne, Anwesenheit, Noten und Familien für Lehrkräfte im Klassenzimmer.',
        intro:
          'Erledigen Sie Planung und Papierkram, und stecken Sie Ihre Energie in den Unterricht.',
        n1Title: 'Schneller planen',
        n1Text:
          'Wochenpläne, Folien und Arbeitsblätter, von der KI entworfen und bereit zum Anpassen.',
        n2Title: 'Mit weniger Aufwand bewerten',
        n2Text:
          'Online-Tests über einen Link, automatische Bewertung geschlossener Fragen, KI-Vorschläge für offene.',
        n3Title: 'Familien auf dem Laufenden halten',
        n3Text: 'Private Familienlinks zeigen bestätigte Noten und die Anwesenheit.',
      },
      homeschool: {
        title: 'Homeschooling-Familien',
        description: 'Pläne, Nachweise, Lernpfade und Fortschritt für Homeschooling-Familien.',
        intro: 'Struktur für Ihr Homeschooling, ohne Fleißarbeit.',
        n1Title: 'Ein Plan für jede Woche',
        n1Text: 'Wochenpläne mit Common-Core-Standards für jedes Fach und jede Klassenstufe.',
        n2Title: 'Nachweise, die Sie vorzeigen können',
        n2Text: 'Anwesenheit, Noten und Zeugnisse an einem Ort.',
        n3Title: 'Lernen im eigenen Tempo',
        n3Text:
          'Von der KI entworfene Lernpfade und Spiele, die Ihre Kinder über einen privaten Link öffnen.',
      },
      tutors: {
        title: 'Nachhilfelehrkräfte',
        description: 'Materialien, Übung und Fortschritt für Nachhilfelehrkräfte.',
        intro: 'Bereiten Sie Stunden schnell vor und zeigen Sie Fortschritte klar.',
        n1Title: 'Materialien auf Abruf',
        n1Text: 'Arbeitsblätter, Quizze und Folien für jedes Thema und jedes Niveau.',
        n2Title: 'Üben zwischen den Stunden',
        n2Text: 'Weisen Sie Tests, Spiele und Lernpfade über Links zu; keine Schülerkonten nötig.',
        n3Title: 'Fortschritt für Eltern',
        n3Text: 'Teilen Sie einen Familienlink mit Lesezugriff und bestätigten Ergebnissen.',
      },
      schools: {
        title: 'Schulen',
        description:
          'Ein Arbeitsbereich für alle Lehrkräfte, mit Verwaltungsseiten und Massenimport.',
        intro:
          'Geben Sie allen Lehrkräften dieselben Werkzeuge, und halten Sie Schülerdaten innerhalb einer Schule.',
        n1Title: 'Verwaltungsseiten',
        n1Text:
          'Schuladministratoren sehen ihre Benutzer, ändern Rollen und übergeben Klassen von einer Lehrkraft an eine andere.',
        n2Title: 'Massenimport',
        n2Text: 'Importieren Sie Lehrkräfte und Klassenlisten aus Tabellen.',
        n3Title: 'Tarif „Schule“',
        n3Text: 'Preis pro Lehrkraft, jährlich abgerechnet, ab 10 Lehrkräften.',
      },
    },
    pricingPage: {
      metaTitle: 'Preise | TeacherHubPro',
      metaDescription:
        'Tarife „Einzelperson“, „Schule“ und „Bezirk“, mit einer kostenlosen 7-tägigen Testphase und ohne Zahlungskarte.',
      title: 'Preise',
      intro:
        'Jeder Tarif enthält alle Funktionen. Beginnen Sie mit einer kostenlosen {days}-tägigen Testphase; keine Zahlungskarte nötig.',
      minimum: 'Ab {count} Lehrkräften',
      start: 'Kostenlos testen',
      contactSales: 'Kontakt aufnehmen',
      faqTitle: 'Fragen zu den Preisen',
      faq1Q: 'Was passiert, wenn die Testphase endet?',
      faq1A:
        'Ihre Daten bleiben erhalten. Um die App weiter zu nutzen, wählen Sie einen Tarif auf der Seite „Tarife und Abrechnung“.',
      faq2Q: 'Wie funktionieren die Tarife „Schule“ und „Bezirk“?',
      faq2A:
        'Sie zahlen pro Lehrkraft, jährlich abgerechnet: „Schule“ ab 10 Lehrkräften, „Bezirk“ ab 100.',
      faq3Q: 'Wie bezahle ich?',
      faq3A:
        'Zahlungen werden von Stripe abgewickelt. TeacherHubPro sieht oder speichert niemals Kartennummern.',
    },
    integrationsPage: {
      metaTitle: 'Integrationen | TeacherHubPro',
      metaDescription:
        'Google-Anmeldung, Google Classroom, Forms, Drive und Slides, Canva, Microsoft OneDrive, Stripe und E-Mail.',
      title: 'Integrationen',
      intro:
        'Die Dienste, mit denen TeacherHubPro heute zusammenarbeitet, über ihre offiziellen APIs.',
      googleSignIn: 'Google-Anmeldung',
      googleSignInText: 'Registrieren und anmelden mit Ihrem Google-Konto.',
      classroom: 'Google Classroom',
      classroomText:
        'Klassenlisten importieren, Aufgaben und Word-Dokumente veröffentlichen und Präsentationen senden.',
      forms: 'Google Forms',
      formsText: 'Machen Sie aus den Fragen einer Aufgabe ein Google-Forms-Quiz.',
      slides: 'Google Drive und Slides',
      slidesText:
        'Word-Dokumente und Präsentationen werden in Ihrem eigenen Google Drive erstellt.',
      canva: 'Canva',
      canvaText:
        'Öffnen Sie Präsentationen und Arbeitsblätter in Ihrem eigenen Canva-Konto als bearbeitbare Designs. Gesendet wird nur, was Sie auswählen, niemals Daten von Schülerinnen und Schülern.',
      microsoft: 'Microsoft OneDrive',
      microsoftText:
        'Speichern Sie Präsentationen (PowerPoint) und Arbeitsblätter (Word) in einem Ordner „TeacherHubPro“ in Ihrem eigenen OneDrive. Gesendet werden nur die Dateien, die Sie speichern, niemals Daten von Schülerinnen und Schülern.',
      teams: 'Microsoft Teams (für Schulen)',
      teamsText:
        'Nutzt Ihre Schule Microsoft Teams? Nehmen Sie Kontakt mit uns auf, und wir richten die Teams-Verbindung für Ihre Klassen ein: Klassenlisten aus einer Teams-Klasse importieren und Aufgaben mit ihr teilen. Die IT-Administration Ihrer Schule genehmigt sie einmalig.',
      teamsContact: 'Kontakt aufnehmen',
      stripe: 'Stripe',
      stripeText: 'Sichere Zahlungen für Tarife; Kartendaten berühren nie unsere Server.',
      email: 'E-Mail',
      emailText:
        'Links zum Familienportal, Passwort-Links und wöchentliche Neuigkeiten für Eltern per E-Mail.',
    },
    enterprisePage: {
      metaTitle: 'Schulen und Bezirke | TeacherHubPro',
      metaDescription:
        'TeacherHubPro für Schulen und Bezirke: Verwaltungsseiten, Massenimport und Tarife pro Lehrkraft.',
      title: 'Für Schulen und Bezirke',
      intro:
        'Geben Sie allen Lehrkräften denselben Arbeitsbereich, und halten Sie Schülerdaten innerhalb Ihrer Schule.',
      p1Title: 'Verwaltungsseiten',
      p1Text:
        'Sehen Sie alle Benutzer Ihrer Schule, ändern Sie Rollen, senden Sie Passwort-Links und übergeben Sie Klassen.',
      p2Title: 'Massenimport',
      p2Text:
        'Lehrkräfte und Klassenlisten aus CSV-Dateien, Zeile für Zeile geprüft, bevor etwas angelegt wird.',
      p3Title: 'Datenschutz durch Technikgestaltung',
      p3Text:
        'Daten pro Schule getrennt, gehashte Schüler- und Familienlinks, verschlüsselte Google-Tokens und eine KI, die nur entwirft.',
      p4Title: 'Tarife pro Lehrkraft',
      p4Text: '„Schule“ ab 10 Lehrkräften und „Bezirk“ ab 100, jährlich abgerechnet.',
      cta: 'Sprechen Sie mit uns über Ihre Schule',
    },
    contactPage: {
      metaTitle: 'Kontakt | TeacherHubPro',
      metaDescription:
        'Fragen, eine Demo für Ihre Schule oder Hilfe: Schreiben Sie dem TeacherHubPro-Team.',
      title: 'Kontakt',
      intro:
        'Fragen, eine Demo für Ihre Schule oder Hilfe mit Ihrem Konto: Wir lesen jede Nachricht.',
      name: 'Ihr Name',
      email: 'E-Mail',
      organization: 'Schule oder Organisation (optional)',
      role: 'Ich bin',
      phone: 'Telefon (optional)',
      interest: 'Ich interessiere mich für',
      message: 'Nachricht',
      consent: 'Wir verwenden diese Angaben nur, um Ihnen zu antworten. Wir verkaufen sie niemals.',
      send: 'Senden',
      sent: 'Vielen Dank. Wir melden uns bald bei Ihnen.',
    },
    roles: {
      teacher: 'Lehrkraft',
      homeschool: 'Homeschooling-Elternteil',
      tutor: 'Nachhilfelehrkraft',
      school_admin: 'Schuladministrator/in',
      principal: 'Schulleitung',
      district: 'Bezirksleitung',
      parent: 'Elternteil',
      other: 'Sonstiges',
    },
    interests: {
      features: 'Funktionen',
      pricing: 'Preise',
      demo: 'Eine Demo',
      school: 'Einen Tarif für meine Schule',
      enterprise: 'Einen Tarif für einen Bezirk',
      support: 'Hilfe mit meinem Konto',
      other: 'Etwas anderes',
    },
    helpPage: {
      metaTitle: 'Hilfe | TeacherHubPro',
      metaDescription: 'Starten Sie mit TeacherHubPro und finden Sie Antworten auf häufige Fragen.',
      title: 'Hilfe',
      intro: 'Beginnen Sie hier, oder schreiben Sie uns über die Kontaktseite.',
      startTitle: 'Erste Schritte',
      step1: 'Registrieren Sie sich mit Ihrer E-Mail-Adresse oder Ihrem Google-Konto.',
      step2:
        'Legen Sie eine Klasse an und importieren Sie Ihre Klassenliste aus einer CSV-Datei oder aus Google Classroom.',
      step3: 'Richten Sie Notenkategorien ein und erfassen Sie Ihre erste Anwesenheit.',
      step4:
        'Bitten Sie die KI um einen Wochenplan, oder den Vorbereitungsagenten um eine ganze Woche.',
      faqTitle: 'Häufige Fragen',
      faq1Q: 'Wie erhalten Schülerinnen und Schüler ihre Aufgaben?',
      faq1A:
        'Sie erstellen aus einer Aufgabe private Links pro Schüler bzw. Schülerin; diese öffnen sie ohne Konto.',
      faq2Q: 'Wie sehen Familien den Fortschritt?',
      faq2A:
        'Senden Sie jeder Familie einen privaten Portal-Link mit Lesezugriff; er zeigt nur Noten, die Sie bestätigt haben.',
      faq3Q: 'Ich habe mein Passwort vergessen.',
      faq3A:
        'Nutzen Sie „Passwort vergessen?“ auf der Anmeldeseite; wir senden Ihnen einen einmaligen Link per E-Mail.',
      faq4Q: 'Wie verbinde ich Google Classroom?',
      faq4A:
        'Öffnen Sie die Einstellungen, wählen Sie „Google Classroom verbinden“ und dann Ihr Lehrkraftkonto.',
    },
    chat: {
      open: 'Mit Ed chatten',
      close: 'Chat schließen',
      title: 'Ed, der KI-Assistent von TeacherHubPro',
      intro:
        'Hallo! Ich bin Ed, ein KI-Assistent. Ich kann Fragen zu den Funktionen und Preisen von TeacherHubPro beantworten.',
      rolePrompt: 'Was beschreibt Sie am besten?',
      interestPrompt: 'Worüber möchten Sie mehr erfahren?',
      placeholder: 'Geben Sie Ihre Frage ein',
      send: 'Senden',
      you: 'Sie',
      ed: 'Ed',
      thinking: 'Ed schreibt…',
      failed:
        'Entschuldigung, darauf konnte ich nicht antworten. Versuchen Sie es erneut, oder nutzen Sie die Kontaktseite.',
      limit:
        'Dieser Chat hat sein Limit erreicht. Bitte nutzen Sie die Kontaktseite, um das Team zu erreichen.',
      leadPrompt:
        'Möchten Sie, dass sich das Team bei Ihnen meldet? Hinterlassen Sie Ihre Angaben.',
      leadOpen: 'Meine Angaben hinterlassen',
      leadSent: 'Danke! Das Team meldet sich bei Ihnen.',
      aiNote:
        'Die Antworten stammen von einer KI und können falsch sein; maßgeblich sind die Preise auf der Seite „Preise“.',
    },
    leads: {
      title: 'Interessenten',
      intro:
        'Personen, die ihre Angaben im Website-Chat oder im Kontaktformular hinterlassen haben.',
      score_high: 'Hoch',
      score_medium: 'Mittel',
      score_low: 'Niedrig',
      source_chat: 'Chat',
      source_contact: 'Kontaktformular',
      status_new: 'Neu',
      status_contacted: 'Kontaktiert',
      status_closed: 'Abgeschlossen',
      search: 'Nach Name, E-Mail oder Organisation suchen',
      score: 'Priorität',
      source: 'Quelle',
      status: 'Status',
      all: 'Alle',
      filter: 'Filtern',
      empty: 'Noch keine Interessenten.',
      received: 'Eingegangen',
      saveStatus: 'Status speichern',
      statusFor: 'Status für {name}',
    },
  },
  legal: {
    updated: 'Zuletzt aktualisiert: {date}',
    contact: 'Fragen zu dieser Seite? Schreiben Sie uns über die Kontaktseite.',
    privacy: {
      title: 'Datenschutzerklärung',
      description: 'Welche Daten TeacherHubPro speichert, warum und wie sie geschützt werden.',
      s1Title: 'Für wen sie gilt',
      s1Text:
        'Diese Erklärung gilt für Lehrkräfte, Schulpersonal und Homeschooling-Eltern, die TeacherHubPro nutzen, sowie für die Schüler- und Familiendaten, die sie eingeben. Schülerinnen, Schüler und Familien legen keine Konten an; sie nutzen private Links, die eine Lehrkraft ihnen gibt.',
      s2Title: 'Was wir speichern',
      s2Text:
        'Kontodaten (Name, E-Mail, Schule, Sprache), was Lehrkräfte erstellen (Klassen, Pläne, Aufgaben, Noten, Anwesenheit, Notizen) und was Schülerinnen und Schüler über ihre Links einreichen. Schülerdatensätze enthalten nur, was eine Funktion braucht: Namen, eine optionale Schülernummer, eine optionale E-Mail-Adresse der Eltern und optionale Nachteilsausgleiche.',
      s3Title: 'Wie wir sie verwenden',
      s3Text:
        'Nur, um den Dienst für die Schule oder Lehrkraft zu betreiben, die sie eingegeben hat. Wir verkaufen keine personenbezogenen Daten und verwenden Schülerdaten nicht für Werbung.',
      s4Title: 'An wen wir sie weitergeben',
      s4Text:
        'An Dienstleister, die die App betreiben: unseren Hosting- und Datenbankanbieter, Stripe für Zahlungen, einen E-Mail-Anbieter für Nachrichten, Anthropic (Claude) für KI-Entwürfe, OpenAI für vorgelesene Audioinhalte, Google, wenn eine Lehrkraft Google Classroom verbindet, Canva, wenn eine Lehrkraft Canva verbindet (nur die Präsentation oder das Arbeitsblatt, das sie dort öffnet, niemals Daten von Schülerinnen und Schülern), und Microsoft, wenn eine Lehrkraft Microsoft verbindet (nur die Dateien, die sie in OneDrive speichert, niemals Daten von Schülerinnen und Schülern). Jeder erhält nur, was seine Aufgabe braucht.',
      s5Title: 'Wie sie geschützt werden',
      s5Text:
        'Passwörter werden als Einweg-Hashes gespeichert. Sitzungs-, Schüler-, Familien- und Passwort-Links sind zufällig und werden nur als Hashes gespeichert. Google-Classroom-, Canva- und Microsoft-Tokens sind verschlüsselt. Jeder Datensatz gehört zu genau einer Schule und ist nur für die Benutzer dieser Schule erreichbar. Auch der Kalenderlink einer Lehrkraft ist zufällig und wird nur als Hash gespeichert: Er zeigt nur die Titel von Plänen und Aufgaben mit ihren Daten, nie Informationen über Schülerinnen und Schüler, und die Lehrkraft kann ihn in den Einstellungen ersetzen oder ausschalten.',
      s6Title: 'Aufbewahrung und Löschung von Daten',
      s6Text:
        'Die Daten bleiben erhalten, solange das Konto aktiv ist. Hochgeladene PDFs werden gelöscht, sobald sie gelesen wurden. Website-Chats werden nach 30 Tagen gelöscht. Um eine Kopie oder die Löschung Ihrer Daten anzufordern, schreiben Sie uns über die Kontaktseite.',
    },
    terms: {
      title: 'Nutzungsbedingungen',
      description: 'Die Bedingungen für die Nutzung von TeacherHubPro.',
      s1Title: 'Der Dienst',
      s1Text:
        'TeacherHubPro ist eine Web-App für den Unterricht: Planung, Klassen, Anwesenheit, Noten, Aufgaben, KI-Werkzeuge für Entwürfe und Familienportale.',
      s2Title: 'Ihr Konto',
      s2Text:
        'Konten sind für Erwachsene: Lehrkräfte, Schulpersonal, Nachhilfelehrkräfte und Eltern. Schülerinnen und Schüler haben keine Konten; sie nutzen die privaten Links, die ihre Lehrkraft teilt. Halten Sie Ihr Passwort sicher, nutzen Sie die App für Lehren und Lernen und befolgen Sie die Regeln zur zulässigen Nutzung. Sie sind verantwortlich für die Inhalte, die Sie erstellen, und die Schülerdaten, die Sie eingeben, sowie dafür, dass Sie berechtigt sind, sie einzugeben.',
      s3Title: 'KI-Entwürfe',
      s3Text:
        'KI-Funktionen erstellen Entwürfe, die Fehler enthalten können. Sie prüfen und genehmigen sie vor der Verwendung; Noten und Berichte zählen erst, wenn Sie sie bestätigen.',
      s4Title: 'Tarife und Zahlung',
      s4Text:
        'Neue Konten erhalten eine kostenlose 7-tägige Testphase. Kostenpflichtige Tarife verlängern sich bis zur Kündigung; die Preise stehen auf der Seite „Preise“. Zahlungen werden von Stripe abgewickelt.',
      s5Title: 'Ihre Inhalte',
      s5Text:
        'Sie behalten die Rechte an dem, was Sie erstellen. Sie erlauben uns, es nur zu speichern und zu verarbeiten, um den Dienst für Sie zu betreiben.',
      s6Title: 'Änderungen',
      s6Text:
        'Wir können diese Bedingungen aktualisieren; das Datum der neuesten Fassung zeigen wir auf dieser Seite an.',
    },
    cookies: {
      title: 'Cookies',
      description: 'Die Cookies, die TeacherHubPro verwendet.',
      s1Title: 'Nur, was die App braucht',
      s1Text:
        'TeacherHubPro verwendet einige wenige Cookies, um zu funktionieren. Wir verwenden keine Werbe- oder Tracking-Cookies.',
      s2Title: 'Die Cookies',
      s2Text:
        'thp_session hält Sie angemeldet (30 Tage). thp_oauth_state schützt die Google-Anmeldung und die Verbindung mit Classroom, während sie stattfinden. thp_tz merkt sich Ihre Zeitzone, damit „heute“ Ihr Heute ist. thp_tour_seen merkt sich, dass Sie die Willkommenstour geschlossen haben.',
      s3Title: 'Der Website-Chat',
      s3Text:
        'Der Website-Chat speichert seinen Gesprächsschlüssel nur in Ihrem Browser-Tab, und er endet, wenn Sie den Tab schließen.',
    },
    accessibility: {
      title: 'Barrierefreiheit',
      description: 'Wie TeacherHubPro auf Barrierefreiheit hinarbeitet.',
      s1Title: 'Unser Ziel',
      s1Text:
        'Wir streben an, dass TeacherHubPro WCAG 2 Stufe AA erfüllt, damit jede Lehrkraft, jede Schülerin und jeder Schüler und jede Familie es nutzen kann.',
      s2Title: 'Was wir tun',
      s2Text:
        'Die Seiten werden bei jeder Änderung automatisch auf Probleme nach WCAG 2 A und AA getestet. Die App funktioniert mit der Tastatur, verwendet beschriftete Formulare und Überschriften, folgt Ihrer hellen oder dunklen Einstellung und kann Texte vorlesen.',
      s3Title: 'Sagen Sie es uns',
      s3Text:
        'Wenn etwas schwer zu bedienen ist, schreiben Sie uns über die Kontaktseite und nennen Sie uns die Seite und was passiert ist.',
    },
    acceptableUse: {
      title: 'Zulässige Nutzung',
      description: 'Wofür TeacherHubPro verwendet werden darf und wofür nicht.',
      s1Title: 'Nutzen Sie es für den Unterricht',
      s1Text:
        'Nutzen Sie TeacherHubPro, um zu planen, zu unterrichten, zu bewerten und mit Familien zu kommunizieren.',
      s2Title: 'Nicht erlaubt',
      s2Text:
        'Geben Sie keine Schülerdaten ein, die Sie nicht weitergeben dürfen, versuchen Sie nicht, auf die Daten einer anderen Schule zuzugreifen, teilen Sie private Schüler- oder Familienlinks nicht öffentlich, überlasten oder greifen Sie den Dienst nicht an, verwenden Sie die KI-Werkzeuge nicht, um schädliche, rechtswidrige oder sachfremde Inhalte zu erstellen, und nutzen Sie den Dienst nicht als Schülerin oder Schüler, um Ihre eigenen Schulaufgaben zu erledigen.',
      s3Title: 'Bei Regelverstößen',
      s3Text:
        'Wir können den Zugang sperren, wenn er Schülerinnen und Schüler, Schulen oder den Dienst gefährdet.',
    },
    ferpa: {
      title: 'FERPA',
      description: 'Wie TeacherHubPro mit Bildungsunterlagen umgeht.',
      s1Title: 'Bildungsunterlagen',
      s1Text:
        'Noten, Anwesenheit, Aufgaben und Notizen, die Lehrkräfte eingeben, sind Bildungsunterlagen. Wir verarbeiten sie nur, um den Dienst für die Schule oder Lehrkraft bereitzustellen, nach deren Weisung.',
      s2Title: 'Zugriff',
      s2Text:
        'Die Unterlagen sind nur für Benutzer der Schule erreichbar, zu der sie gehören. Familien sehen die bestätigten Noten und die Anwesenheit ihres eigenen Kindes über einen privaten Link.',
      s3Title: 'Keine andere Verwendung',
      s3Text: 'Wir verkaufen keine Bildungsunterlagen und verwenden sie nicht für Werbung.',
    },
    coppa: {
      title: 'Datenschutz für Kinder (COPPA)',
      description: 'Wie TeacherHubPro die Daten von Kindern schützt.',
      s1Title: 'Keine Schülerkonten',
      s1Text:
        'Schülerinnen und Schüler registrieren sich nicht und geben uns keine personenbezogenen Daten direkt. Lehrkräfte, Schulen und Eltern geben die Daten ein, die eine Funktion braucht, und Schülerinnen und Schüler nutzen private Links.',
      s2Title: 'Nur, was nötig ist',
      s2Text:
        'Wir erheben nur, was eine Funktion braucht, senden der KI nur, was eine Aufgabe braucht, und verwenden die Daten von Kindern niemals für Werbung.',
      s3Title: 'Eltern',
      s3Text:
        'Eltern können die Lehrkraft oder Schule ihres Kindes bitten, die Daten ihres Kindes einzusehen oder zu löschen, oder uns über die Kontaktseite schreiben.',
    },
    aiGovernance: {
      title: 'KI-Governance',
      description: 'Die Regeln, denen die KI-Funktionen von TeacherHubPro folgen.',
      s1Title: 'Nur Entwürfe',
      s1Text:
        'KI-Noten, Schüleranalysen, Pläne, Vorbereitungspakete und Elternmails sind Entwürfe, bis eine Lehrkraft sie freigibt. Zeugnisse, die Gesamtnote im Notenbuch und Familienportale zeigen nur von der Lehrkraft bestätigte Noten.',
      s2Title: 'Möglichst wenig Daten',
      s2Text:
        'Jede KI-Aufgabe erhält nur die Felder, die sie braucht. Schüleranalysen erhalten Zahlen und Aufgabentitel, keine Namen. Prompts, Schülerarbeiten und personenbezogene Daten werden nicht in Logs geschrieben.',
      s3Title: 'Keine erfundenen Fakten',
      s3Text:
        'Die KI wird angewiesen, keine Noten, Anwesenheiten, Standardcodes, Preise oder Funktionen zu erfinden, und ihre Antworten werden geprüft: Zum Beispiel müssen Standardcodes existieren, und der Website-Chat darf nur echte Preise nennen.',
      s4Title: 'Ehrlich über KI',
      s4Text: 'Der Website-Chat ist ein KI-Assistent und sagt das, wenn er gefragt wird.',
      s5Title: 'Anbieter',
      s5Text:
        'KI-Entwürfe werden mit Claude von Anthropic erstellt; vorgelesene Audioinhalte mit OpenAI.',
    },
    trust: {
      title: 'Trust Center',
      description:
        'Wie TeacherHubPro Schulen, Lehrkräfte, Schülerinnen und Schüler und Familien schützt.',
      s1Title: 'Für Daten von Minderjährigen gebaut',
      s1Text:
        'Schülerinnen, Schüler und Familien nutzen private Links statt Konten. Die Links sind zufällig, werden nur als Hashes gespeichert, können widerrufen werden und laufen ab.',
      s2Title: 'Trennung nach Schulen',
      s2Text:
        'Jeder Datensatz gehört zu genau einer Schule, und jede Aktion prüft die Schule und die Rolle des Benutzers.',
      s3Title: 'Geheimnisse und Passwörter',
      s3Text:
        'Passwörter werden gehasht; Google-Tokens sind verschlüsselt; Geheimnisse werden nie in Logs geschrieben; der Code wird bei jeder Änderung auf geleakte Geheimnisse geprüft.',
      s4Title: 'KI mit Grenzen',
      s4Text:
        'Die KI entwirft nur, erhält nur, was eine Aufgabe braucht, und wird auf erfundene Fakten geprüft. Siehe die Seite zur KI-Governance.',
      s5Title: 'Vereinbarungen',
      s5Text:
        'Sie brauchen einen Auftragsverarbeitungsvertrag oder haben eine Sicherheitsfrage für Ihre Schule? Schreiben Sie uns über die Kontaktseite.',
    },
  },
};
