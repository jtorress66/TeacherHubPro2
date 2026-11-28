import type { DemoMessages } from './marketing-types.ts';

// Die Produkttour auf Deutsch.
export const demoDe: DemoMessages = {
  demo: {
    metaTitle: 'TeacherHubPro-Demo: jede Funktion, Schritt für Schritt',
    metaDescription:
      'Eine geführte Tour durch TeacherHubPro mit echten Bildschirmen: Unterrichtspläne, Anwesenheit, Bewerten mit KI, Spiele, Live-Spiele, Elternportale und mehr.',
    title: 'TeacherHubPro Schritt für Schritt entdecken',
    intro:
      'Eine geführte Tour durch die ganze App in {steps} Schritten, mit echten Bildschirmen. Alle Schülerinnen und Schüler, die Sie sehen, sind erfunden.',
    contents: 'Kapitel',
    chapterNumber: 'Kapitel {n}',
    enlarge: 'Screenshot in voller Größe öffnen: {title}',
    madeUp:
      'Alle Namen, Klassen und Noten auf diesen Screenshots sind erfunden. Die KI-Entwürfe hat die KI der App geschrieben, und sie werden so gezeigt, wie sie entstanden sind.',
    chapters: {
      start: {
        title: 'Erste Schritte',
        intro: 'In einer Minute registriert, und Sie starten mit einer fertigen Beispielklasse.',
      },
      classes: {
        title: 'Klassen, Klassenlisten und Anwesenheit',
        intro:
          'Übernehmen Sie Ihre Schülerinnen und Schüler aus einer Tabelle und erfassen Sie die Anwesenheit in Sekunden.',
      },
      planning: {
        title: 'Unterrichtsplanung',
        intro: 'Wochenpläne nach Common Core und den Standards von Puerto Rico, druckfertig.',
      },
      assistant: {
        title: 'KI-Assistent',
        intro:
          'Arbeitsblätter, Quizze und Bewertungsraster, entworfen für Ihre Klassenstufe und Ihr Thema. Sie bearbeiten und entscheiden.',
      },
      presentations: {
        title: 'Präsentationen',
        intro:
          'Von der KI entworfene Folien, bereit zum Präsentieren oder zum Öffnen in Google Slides, Canva oder OneDrive.',
      },
      prep: {
        title: 'Prep-Agent',
        intro:
          'Aus einem Satz wird eine ganze Woche, und Sie prüfen alles, bevor etwas hinausgeht.',
      },
      assignments: {
        title: 'Aufgaben und Bewerten mit KI',
        intro:
          'Machen Sie aus einer PDF eine Online-Aufgabe, teilen Sie sie per Link und bestätigen Sie die von der KI vorgeschlagenen Noten.',
      },
      gradebook: {
        title: 'Notenbuch und Zeugnisse',
        intro:
          'Gewichtete Kategorien, Halbjahre und Zeugnisse, aus den Noten, die Sie bestätigt haben.',
      },
      games: {
        title: 'Lernspiele',
        intro: 'Elf Spielmodi, mit einer Erklärung zu jeder Antwort und Auswertung nach Standards.',
      },
      live: {
        title: 'Live-Spiele im Klassenzimmer',
        intro:
          'Gemeinsam auf der großen Leinwand spielen, während die Klasse auf dem Handy antwortet.',
      },
      learning: {
        title: 'Adaptives Lernen und Schüleranalysen',
        intro: 'Persönliche Lernpfade und frühe Hinweise darauf, wer Hilfe brauchen könnte.',
      },
      families: {
        title: 'Elternportal',
        intro: 'Familien sehen Noten und Anwesenheit über einen privaten Link, ganz ohne Konto.',
      },
      substitutes: {
        title: 'Vertretungsmappen',
        intro: 'Alles, was eine Vertretung braucht, mit einem Klick gedruckt.',
      },
      connections: {
        title: 'Verbundene Tools',
        intro: 'Funktioniert mit Google, Microsoft, Canva und dem Kurssystem Ihrer Schule.',
      },
      schools: {
        title: 'Für Schulen und Bezirke',
        intro:
          'Nutzung, Einstellungen, ein Protokoll der KI-Freigaben und Ihre Daten, alles an einem Ort.',
      },
    },
    steps: {
      signup: {
        title: 'Konto erstellen',
        text: 'Registrieren Sie sich mit Ihrer E-Mail-Adresse oder Ihrem Google-Konto. Ihre kostenlose Testphase beginnt sofort, ohne Kreditkarte.',
        alt: 'Die Registrierungsseite von TeacherHubPro mit Feldern für Name, E-Mail und Passwort.',
      },
      commandCenter: {
        title: 'Ihre Kommandozentrale',
        text: 'Jeden Morgen sehen Sie die heutigen Stunden, Arbeiten, die auf eine Bewertung warten, und Schülerinnen und Schüler, die Hilfe brauchen könnten, alles auf einem Bildschirm.',
        alt: 'Die Kommandozentrale mit den heutigen Stunden, zu bewertenden Arbeiten und einem Schüler, der Hilfe brauchen könnte.',
      },
      sampleClass: {
        title: 'Mit einer Beispielklasse ausprobieren',
        text: 'Ein Klick fügt eine Beispielklasse mit erfundenen Schülern, Noten und Anwesenheiten hinzu, damit Sie alles ausprobieren können, bevor Sie Ihre eigenen anlegen. Entfernen Sie sie, wann Sie möchten.',
        alt: 'Die Seite der Beispielklasse mit sechs erfundenen Schülern.',
      },
      rosterImport: {
        title: 'Klassenliste importieren',
        text: 'Laden Sie eine Tabelle mit Vor- und Nachnamen hoch. Schülernummern, Eltern-E-Mails, Fördermaßnahmen und die Sprache der Familie sind optionale Spalten.',
        alt: 'Eine Klassenliste nach dem Import der Schüler aus einer Tabelle.',
      },
      accommodations: {
        title: 'Fördermaßnahmen an einem Ort',
        text: 'Notieren Sie die Fördermaßnahmen jedes Schülers einmal. Sie erscheinen dort, wo sie wichtig sind, etwa in der Vertretungsmappe, und bleiben Ihnen und Ihrer Schule vorbehalten.',
        alt: 'Das Bearbeitungsformular eines Schülers mit ausgefülltem Feld für Fördermaßnahmen.',
      },
      attendance: {
        title: 'Anwesenheit in Sekunden erfassen',
        text: 'Markieren Sie jeden Schüler als anwesend, abwesend, verspätet oder entschuldigt, tragen Sie die Minuten der Verspätung ein und speichern Sie den Tag.',
        alt: 'Die Anwesenheitsliste mit einem Status für jeden Schüler.',
      },
      attendanceReport: {
        title: 'Anwesenheit auf einen Blick',
        text: 'Der Anwesenheitsbericht zeigt für die gewählten Tage die Quote jedes Schülers sowie jede Abwesenheit und jede Verspätung.',
        alt: 'Der Anwesenheitsbericht mit der Anwesenheitsquote jedes Schülers.',
      },
      planner: {
        title: 'Die Woche mit Standards planen',
        text: 'Schreiben Sie Ihren Wochenplan Tag für Tag und wählen Sie Standards aus den offiziellen Listen von Common Core und Puerto Rico. Die App erfindet nie einen Standardcode.',
        alt: 'Der Wochenplaner mit geöffneter Auswahl der Standards von Puerto Rico.',
      },
      planPrint: {
        title: 'Im Format Ihrer Schule drucken',
        text: 'Drucken Sie Pläne im klassischen Format mit dem Briefkopf Ihrer Schule oder in einem schlichten einseitigen Format.',
        alt: 'Ein Wochenplan, druckfertig im klassischen Format.',
      },
      curriculum: {
        title: 'Den Lehrplan Ihrer Schule hinzufügen',
        text: 'Laden Sie die Stoffverteilungspläne Ihrer Schule hoch oder fügen Sie sie ein. Die KI folgt ihnen beim Entwerfen, damit die Entwürfe zu dem passen, was Ihre Schule unterrichtet.',
        alt: 'Die Seite zum Lehrplan der Schule mit einem einsatzbereiten Stoffverteilungsplan.',
      },
      templates: {
        title: 'Mit einer Vorlage beginnen',
        text: 'Beginnen Sie einen Plan mit einer fertigen Einheit oder einer eigenen und ändern Sie danach, was Sie möchten.',
        alt: 'Die Vorlagenseite mit fertigen Einheiten.',
      },
      assistantForm: {
        title: 'Den KI-Assistenten fragen',
        text: 'Wählen Sie Arbeitsblatt, Quiz oder Unterrichtsplan, dann Fach, Klassenstufe, Thema und Sprache. Mit ESL-Unterstützung entsteht Material auf dem Niveau von Englischlernenden, nach WIDA und den Standards von Puerto Rico.',
        alt: 'Das Formular des KI-Assistenten mit Art, Thema, Klassenstufe und ESL-Unterstützung.',
      },
      assistantResult: {
        title: 'Den Entwurf prüfen',
        text: 'Der Entwurf ist in Sekunden fertig. Kopieren, drucken oder vorlesen lassen, in Canva öffnen oder in OneDrive speichern.',
        alt: 'Ein vom KI-Assistenten entworfenes Arbeitsblatt.',
      },
      rubric: {
        title: 'Bewertungsraster erstellen',
        text: 'Beginnen Sie ein Bewertungsraster von Grund auf oder lassen Sie die KI eines entwerfen, und bearbeiten Sie dann jedes Kriterium und jede Stufe. Damit bewerten Sie schriftliche Antworten.',
        alt: 'Ein Bewertungsraster mit Kriterien und Stufen, bereit zur Bearbeitung.',
      },
      presentation: {
        title: 'Eine Präsentation entwerfen',
        text: 'Geben Sie ein Thema und die Anzahl der Folien an, wählen Sie ein Design und bearbeiten Sie jede Folie, bevor Sie präsentieren.',
        alt: 'Eine von der KI entworfene Präsentation, geöffnet im Folieneditor.',
      },
      presentationExport: {
        title: 'Überall präsentieren',
        text: 'Präsentieren Sie im Browser, laden Sie PowerPoint herunter, senden Sie sie an Google Classroom und Slides, öffnen Sie sie in Canva oder speichern Sie sie in OneDrive.',
        alt: 'Die Optionen einer Präsentation zum Senden an Google Classroom, Canva und OneDrive.',
      },
      prepStart: {
        title: 'Ein Satz, eine ganze Woche',
        text: 'Schreiben Sie, was Sie diese Woche unterrichten. Der Prep-Agent entwirft für jeden Tag Plan, Folien und Arbeitsblätter, dazu ein Freitagsquiz und eine Nachricht an die Familien.',
        alt: 'Das Formular des Prep-Agents mit einem Satz, der die Woche beschreibt.',
      },
      prepReview: {
        title: 'Sie prüfen, bevor etwas hinausgeht',
        text: 'Lesen Sie jeden Teil, behalten oder verwerfen Sie ihn und bearbeiten Sie die E-Mail an die Familien. Nichts wird veröffentlicht oder gesendet, bevor Sie es sagen.',
        alt: 'Die Prüfansicht des Prep-Agents mit Wochenplan, Arbeitsblättern, Quiz und E-Mail an die Familien.',
      },
      pdfImport: {
        title: 'Aus einer PDF eine Online-Aufgabe machen',
        text: 'Laden Sie ein Arbeitsblatt oder einen Test als PDF hoch. Die KI überträgt die Fragen in einen Editor, in dem Sie jede vor dem Speichern prüfen.',
        alt: 'Aus einer PDF importierte Fragen, bereit zum Prüfen und Speichern.',
      },
      studentLinks: {
        title: 'Mit Schülerlinks teilen',
        text: 'Jeder Schüler erhält einen privaten Link: keine Konten oder Passwörter zu verwalten. Sie können einen Link jederzeit ersetzen oder deaktivieren.',
        alt: 'Die Seite der Schülerlinks mit einem Link für jeden Schüler.',
      },
      studentAnswer: {
        title: 'Antworten auf jedem Gerät',
        text: 'Die Schüler öffnen ihren Link auf Handy, Tablet oder Computer, antworten und geben ab. Fragen können vorgelesen werden.',
        alt: 'Ein Schüler beantwortet eine Aufgabe auf dem Handy.',
      },
      aiGrading: {
        title: 'Die KI schlägt vor, Sie entscheiden',
        text: 'Auswahlfragen bewerten sich selbst. Bei schriftlichen Antworten schlägt die KI Punkte und Feedback vor, und nichts zählt, bevor Sie es bestätigen oder ändern.',
        alt: 'Die Antwort eines Schülers mit einer von der KI vorgeschlagenen Punktzahl, die auf die Bestätigung der Lehrkraft wartet.',
      },
      gradebook: {
        title: 'Ein Notenbuch, das aufgeht',
        text: 'Gewichtete Kategorien, die Gesamtnote jedes Schülers und nur die Noten, die Sie bestätigt haben.',
        alt: 'Das Notenbuch mit Kategorien und der Gesamtnote jedes Schülers.',
      },
      reportCards: {
        title: 'Zeugnisse in Minuten',
        text: 'Fügen Sie für jeden Schüler einen Kommentar hinzu und laden Sie die Zeugnisse als PDF herunter, einzeln oder für die ganze Klasse.',
        alt: 'Zeugnisse mit Noten nach Kategorie und einem Kommentar der Lehrkraft.',
      },
      gameBuilder: {
        title: 'Ein Spiel in Minuten erstellen',
        text: 'Schreiben Sie eigene Fragen oder lassen Sie die KI sie entwerfen, und wählen Sie dann aus elf Modi wie Quiz, Gegen die Zeit, Zuordnen, Memory und Kreuzworträtsel.',
        alt: 'Der Spieleditor mit Fragekarten.',
      },
      gameReview: {
        title: 'Die Klasse versteht, warum',
        text: 'Nach einer Runde sehen die Schüler die verpassten Fragen mit der richtigen Antwort und einer kurzen Erklärung, warum sie stimmt.',
        alt: 'Der Rückblick eines Schülers nach einem Spiel, mit den richtigen Antworten und Erklärungen.',
      },
      aiExplanations: {
        title: 'Erklärungen, für Sie geschrieben',
        text: 'Ein Klick, und die KI schreibt ein kurzes „Warum“ für jede Karte, die noch keines hat. Sie lesen und bearbeiten alles vor dem Speichern.',
        alt: 'Von der KI geschriebene Erklärungen, bereit zur Prüfung durch die Lehrkraft.',
      },
      coverage: {
        title: 'Sehen, welche Standards Sie abgedeckt haben',
        text: 'Der Bericht zur Abdeckung der Standards zeigt, wie die Klasse bei jedem markierten Standard abgeschnitten hat, und mit einem Klick wiederholen Sie, was mehr Übung braucht.',
        alt: 'Der Bericht zur Abdeckung der Standards für eine Klasse.',
      },
      liveLobby: {
        title: 'Ein Live-Spiel starten',
        text: 'Zeigen Sie das Spiel auf der großen Leinwand. Die Schüler treten mit einer 6-stelligen PIN bei und tippen auf ihren Namen aus Ihrer Klassenliste.',
        alt: 'Die Lobby des Live-Spiels mit der PIN und den beigetretenen Schülern.',
      },
      livePlayer: {
        title: 'Gespielt wird auf dem Handy',
        text: 'Jeder Schüler antwortet auf dem eigenen Gerät, gegen die Uhr, mit Punkten für Tempo und Serien.',
        alt: 'Ein Schüler beantwortet eine Frage im Live-Spiel auf dem Handy.',
      },
      liveReveal: {
        title: 'Auflösen, erklären, weiterspielen',
        text: 'Nach jeder Frage zeigt die große Leinwand die richtige Antwort, wie die Klasse geantwortet hat und warum, danach die Bestenliste.',
        alt: 'Die große Leinwand mit der richtigen Antwort, den Antworten der Klasse und der Erklärung.',
      },
      learningPath: {
        title: 'Persönliche Lernpfade',
        text: 'Entwerfen Sie eine kurze Lektionsreihe für einen Schüler zu genau dem Thema, das er braucht. Sie bearbeiten sie und weisen sie dann seinem Link zu.',
        alt: 'Ein für einen Schüler entworfener Lernpfad, geöffnet im Editor.',
      },
      studentLesson: {
        title: 'Lektionen im eigenen Tempo',
        text: 'Der Schüler liest jede Lektion, beantwortet eine kurze Lernkontrolle und sieht sein Ergebnis. Sie sehen seinen Fortschritt.',
        alt: 'Ein Schüler arbeitet auf dem Handy eine Lektion durch.',
      },
      insights: {
        title: 'Wissen, wer Hilfe brauchen könnte',
        text: 'Die Seite jedes Schülers bündelt Noten, Anwesenheit und Notizen. Eine KI-Zusammenfassung schlägt nächste Schritte vor, die Sie abwägen können.',
        alt: 'Die Seite eines Schülers mit Noten, Anwesenheit und einer KI-Zusammenfassung.',
      },
      parentPortal: {
        title: 'Familien auf dem Laufenden halten',
        text: 'Familien öffnen einen privaten Link und sehen bestätigte Noten und die Anwesenheit. Wöchentliche Nachrichten vom Prep-Agent können jede Familie in ihrer eigenen Sprache erreichen.',
        alt: 'Das Elternportal auf dem Handy mit Noten und Anwesenheit.',
      },
      subPacket: {
        title: 'Bereit für die Vertretung',
        text: 'Die Vertretungsmappe bündelt Stundenplan, Klassenliste, Pläne, Abläufe und Kontakte, druckfertig.',
        alt: 'Eine Vertretungsmappe mit Stundenplan, Klassenliste und Abläufen.',
      },
      integrations: {
        title: 'Ihre Tools verbinden',
        text: 'Verbinden Sie Google Classroom, Google Drive, Microsoft OneDrive und Teams, Canva und Ihren Kalender. Sie entscheiden, was geteilt wird, Tool für Tool.',
        alt: 'Die Seite Verbundene Tools mit Google, Microsoft und Canva.',
      },
      schoolSystems: {
        title: 'Das Kurssystem Ihrer Schule',
        text: 'Schulen können TeacherHubPro über den Standard LTI 1.3 in Canvas, Schoology, Moodle und D2L Brightspace öffnen und bestätigte Noten zurücksenden. Auf Anfrage verfügbar.',
        alt: 'Der Bereich für Schulsysteme unter Verbundene Tools.',
      },
      schoolOverview: {
        title: 'Die Schulübersicht',
        text: 'Die Schulleitung sieht, wie jede Lehrkraft die App nutzt, und kann KI-Funktionen und Schülerhinweise für die ganze Schule ein- oder ausschalten.',
        alt: 'Die Schulübersicht mit der Nutzung je Lehrkraft und schulweiten Schaltern.',
      },
      schoolUsers: {
        title: 'Die Nutzer Ihrer Schule verwalten',
        text: 'Geben Sie Lehrkräften und Administratoren die passende Rolle und übertragen Sie eine Klasse an eine andere Lehrkraft, wenn jemand die Schule verlässt.',
        alt: 'Die Seite der Schulnutzer mit Rollen.',
      },
      approvals: {
        title: 'Ein Protokoll jeder KI-Freigabe',
        text: 'KI-Inhalte erreichen Schüler und Familien erst, nachdem eine Lehrkraft sie freigegeben hat. Das Freigabeprotokoll zeigt, wer was wann freigegeben hat, ohne Schülernamen oder Noten.',
        alt: 'Das Freigabeprotokoll mit den Freigaben der Lehrkräfte.',
      },
      dataExport: {
        title: 'Ihre Daten bleiben Ihre',
        text: 'Laden Sie jederzeit alle Daten Ihrer Schule herunter oder löschen Sie die Schule und ihre Daten selbst.',
        alt: 'Die Einstellungsseite mit Download und Löschung der Schuldaten.',
      },
      languages: {
        title: 'Sieben Sprachen',
        text: 'Nutzen Sie die App auf Englisch, Spanisch, Französisch, Portugiesisch, Deutsch, Italienisch oder Chinesisch. Die KI schreibt in der Sprache, die Sie wählen.',
        alt: 'Die Einstellungsseite mit der Sprachauswahl.',
      },
    },
  },
};
