import type { MarketingMessages } from './marketing-types.ts';

// Le texte du site public en français : pages marketing, chat du site et pages légales.
// Tout ce qu'il dit doit être vrai de l'application aujourd'hui.

export const marketingFr: MarketingMessages = {
  marketing: {
    nav: {
      label: 'Principal',
      features: 'Fonctionnalités',
      useCases: "Cas d'usage",
      pricing: 'Tarifs',
      contact: 'Contact',
      logIn: 'Se connecter',
      startTrial: 'Essai gratuit',
    },
    footer: {
      tagline:
        "L'espace de travail pédagogique avec IA pour les enseignants, les écoles et les familles qui font l'école à la maison.",
      product: 'Produit',
      useCases: "Cas d'usage",
      company: 'Entreprise',
      legal: 'Mentions légales et confiance',
      ai: "Fonctionnalités d'IA",
      integrations: 'Intégrations',
      enterprise: 'Écoles et districts',
      help: 'Aide',
      rights: '© {year} TeacherHubPro',
    },
    landing: {
      metaTitle: 'TeacherHubPro : votre espace de travail pédagogique avec IA',
      metaDescription:
        "Planifiez vos cours, faites l'appel, notez, créez des diapositives, des jeux et des quiz, et partagez les progrès avec les familles, avec une IA qui propose et vous qui décidez. Essai gratuit de 7 jours.",
      featuresTitle: 'Tout ce dont une semaine de cours a besoin',
      featuresIntro:
        'Un seul espace pour planifier, enseigner, noter et communiquer avec les familles.',
      howTitle: 'Comment ça marche',
      how1Title: 'Créez vos classes',
      how1Text:
        "Ajoutez une classe et importez votre liste d'élèves depuis un tableur ou depuis Google Classroom.",
      how2Title: "Laissez l'IA rédiger un brouillon",
      how2Text:
        "Demandez un plan hebdomadaire, des diapositives, une fiche d'exercices, un quiz ou toute une semaine de préparation. Chaque résultat est un brouillon.",
      how3Title: 'Relisez et utilisez',
      how3Text:
        "Modifiez ce que vous voulez, puis enseignez, attribuez, notez et partagez. Rien n'arrive aux élèves ni aux familles avant que vous ne l'approuviez.",
      whoTitle: 'Conçu pour',
      whoIntro:
        "Les enseignants en classe, les familles qui font l'école à la maison, les tuteurs et des écoles entières.",
      trustTitle: "Des données d'élèves traitées avec soin",
      trustIntro: "Les élèves sont mineurs, et l'application est conçue en conséquence.",
      trust1:
        'Les élèves et les parents utilisent des liens privés, pas des comptes. Les liens sont aléatoires, stockés uniquement sous forme de hachages et peuvent être révoqués.',
      trust2:
        'Chaque donnée appartient à une seule école, et seuls les enseignants de cette école peuvent y accéder.',
      trust3:
        "L'IA ne reçoit que ce dont une tâche a besoin. Les analyses sur les élèves reçoivent des chiffres, jamais un nom.",
      trust4:
        "Les notes et suggestions de l'IA restent des brouillons jusqu'à ce qu'un enseignant les confirme.",
      trustMore: 'Visiter le centre de confiance',
      pricingTitle: 'Des tarifs simples',
      pricingIntro:
        'Commencez par un essai gratuit de {days} jours. Aucune carte de paiement requise.',
      pricingSee: 'Voir toutes les formules',
      faqTitle: 'Questions',
      faq1Q: "Ai-je besoin d'une carte de paiement pour l'essai ?",
      faq1A:
        "Non. L'essai vous donne un accès complet pendant 7 jours ; vous ne choisissez une formule que si vous souhaitez continuer.",
      faq2Q: "L'IA note-t-elle à ma place ?",
      faq2A:
        "Elle suggère des notes et des commentaires pour les réponses ouvertes. Vous confirmez chaque note avant qu'elle ne compte.",
      faq3Q: 'Quelles langues sont prises en charge ?',
      faq3A:
        "TeacherHubPro est entièrement disponible en sept langues : anglais, espagnol, français, portugais, allemand, italien et chinois, et l'IA écrit dans la langue de votre choix.",
      faq4Q: 'Fonctionne-t-elle avec Google Classroom ?',
      faq4A:
        "Oui. Vous pouvez importer des listes d'élèves, publier des devoirs et des documents Word, envoyer des présentations sous forme de Google Slides et créer des quiz Google Forms.",
      faq5Q: "Toute mon école peut-elle l'utiliser ?",
      faq5A:
        "Oui. Les formules École et District ajoutent des enseignants à une même école, avec des pages d'administration et l'import en masse.",
      ctaTitle: 'Essayez-la avec vos propres classes',
      ctaText:
        "Créez une classe en quelques minutes et laissez l'IA préparer un brouillon de votre semaine prochaine.",
    },
    video: {
      title: 'Découvrez TeacherHubPro en une minute environ',
      note: 'La vidéo est narrée en anglais, avec des sous-titres en français : choisissez CC dans le lecteur.',
      scriptTitle: 'Lire le texte de la vidéo',
      p1: 'Voici TeacherHubPro, votre espace de travail pédagogique avec IA, conçu pour faciliter l’enseignement au quotidien.',
      p2: 'Vous préparez la semaine prochaine ? Tapez une seule phrase. L’Agent de préparation rédige vos plans de cours, diaporamas, fiches d’exercices, un quiz du vendredi et même un e-mail aux parents.',
      p3: 'Chaque plan hebdomadaire est aligné sur les normes Common Core, organisé par jour et entièrement modifiable. Votre plan, à votre façon.',
      p4: 'Transformez n’importe quel cours en diapositives en quelques secondes. Présentez en plein écran en classe, imprimez des polycopiés ou envoyez-les directement dans Google Classroom.',
      p5: 'Créez des tests en ligne ou importez un PDF. Les élèves répondent depuis un lien privé, et l’IA suggère des notes que vous confirmez.',
      p6: 'Gardez votre carnet de notes, vos bulletins et les présences au même endroit, avec un portail privé qui tient les familles informées.',
      p7: 'Commencez chaque journée avec le Centre de commande : les cours du jour, ce qu’il reste à corriger, les élèves qui pourraient avoir besoin d’aide et les prochaines leçons.',
      p8: 'Et vous gardez toujours la main. L’IA rédige, vous décidez. Rien n’arrive aux élèves ni aux familles avant que vous ne l’approuviez.',
      p9: 'Essayez TeacherHubPro gratuitement pendant sept jours. Sans carte bancaire. Rendez-vous sur teacherhubpro.com.',
    },
    feature: {
      lesson_planner: {
        title: 'Planificateur de cours',
        text: "Des plans hebdomadaires avec les normes Common Core, rédigés par l'IA et modifiés par vous.",
      },
      ai_assistant: {
        title: 'Assistant IA',
        text: "Fiches d'exercices, quiz, résumés et activités dans votre langue.",
      },
      presentations: {
        title: 'Présentations',
        text: "Des diapositives rédigées par l'IA, présentées en plein écran, imprimées ou envoyées vers Google Classroom.",
      },
      gradebook: {
        title: 'Carnet de notes et bulletins',
        text: 'Catégories pondérées, devoirs et bulletins en PDF avec le logo de votre école.',
      },
      attendance: {
        title: 'Présences',
        text: 'Appel quotidien avec retards, absences justifiées et rapports.',
      },
      assignments: {
        title: 'Évaluations en ligne et correction par IA',
        text: "Créez des questions ou importez une évaluation en PDF ; les élèves répondent depuis un lien ; vous confirmez les notes suggérées par l'IA.",
      },
      games: {
        title: 'Jeux et jeux en direct',
        text: 'Des jeux éducatifs dans de nombreux modes, et des jeux en direct en classe que les élèves rejoignent avec un code PIN.',
      },
      learning: {
        title: "Parcours d'apprentissage",
        text: "Des leçons rédigées par l'IA avec des vérifications, attribuées aux élèves via des liens privés.",
      },
      families: {
        title: 'Portail des familles',
        text: 'Chaque famille reçoit un lien privé, en lecture seule, vers les notes confirmées et les présences.',
      },
      command_center: {
        title: 'Centre de commande',
        text: "Les classes du jour, ce qu'il reste à noter, les élèves qui pourraient avoir besoin d'aide, et des suggestions.",
      },
      prep_agent: {
        title: 'Agent de préparation',
        text: "Une phrase devient une semaine : plan, diapositives, fiches d'exercices, un quiz du vendredi et un e-mail aux parents à relire.",
      },
      schools: {
        title: 'Pour les écoles',
        text: "Les administrateurs d'école gèrent les utilisateurs et les rôles ; import en masse des enseignants et des élèves.",
      },
    },
    featuresPage: {
      metaTitle: 'Fonctionnalités | TeacherHubPro',
      metaDescription:
        "Planification des cours, outils d'IA, carnet de notes, présences, présentations et un fonctionnement pensé pour les enseignants, dans un seul espace.",
      title: 'Fonctionnalités',
      intro: "Ce que vous pouvez faire avec TeacherHubPro aujourd'hui.",
      learnMore: 'En savoir plus sur {feature}',
      allFeatures: 'Toutes les fonctionnalités',
    },
    included: {
      title: 'Tout est inclus',
      intro: 'Toutes les fonctionnalités de TeacherHubPro aujourd’hui, en une seule liste.',
      prepAgent:
        'Agent de préparation : une phrase devient une semaine de plans de cours, diaporamas, fiches d’exercices, un quiz du vendredi et un e-mail aux parents, prêts à être relus',
      planner:
        'Planificateur de cours IA avec les normes Common Core et de Porto Rico, en présentation simple ou classique',
      assistant:
        'Assistant IA pour fiches d’exercices, quiz, résumés et activités, avec un soutien pour les élèves allophones (ESL)',
      presentations:
        'Présentations IA à projeter en plein écran, imprimer, télécharger en PowerPoint ou envoyer vers Google Classroom',
      tests:
        'Évaluations en ligne auxquelles les élèves répondent via un lien privé ; rédigez les questions ou importez une évaluation PDF',
      aiGrading:
        'Correction IA des réponses ouvertes, sous forme de suggestions que l’enseignant confirme',
      gradebook: 'Carnet de notes pondéré et bulletins PDF avec le logo de votre école',
      attendance: 'Appel quotidien avec retards, absences justifiées et rapports',
      games:
        'Jeux éducatifs dans de nombreux modes, et jeux en direct que les élèves rejoignent avec un code PIN',
      learning:
        'Parcours d’apprentissage : leçons rédigées par l’IA avec vérifications, attribuées via des liens privés',
      families:
        'Portail familles : un lien privé en lecture seule vers les notes confirmées et les présences, plus un point hebdomadaire par e-mail',
      commandCenter:
        'Centre de commande : les cours du jour, ce qu’il reste à corriger et les élèves qui pourraient avoir besoin d’aide',
      subPacket: 'Dossiers pour les remplaçants',
      listen: 'Écouter : plans et supports lus à voix haute',
      google:
        'Intégration Google : connexion avec Google, Google Classroom (import des listes, publication de devoirs, documents Word et présentations), quiz Google Forms et fichiers dans votre propre Google Drive',
      canva:
        'Canva : ouvrez vos présentations et fiches dans votre propre compte Canva comme designs modifiables',
      microsoft:
        'Microsoft OneDrive : enregistrez vos présentations en PowerPoint et vos fiches en Word dans votre propre OneDrive',
      teams:
        'Microsoft Teams, pour les écoles qui utilisent Teams en classe : sur demande, importez les listes de classe depuis une classe Teams et partagez-y des devoirs. L’administrateur informatique de votre école approuve la connexion une seule fois.',
      languages:
        'Sept langues : anglais, espagnol, français, portugais, allemand, italien et chinois ; l’IA écrit dans la langue choisie',
      privacy:
        'Pas de comptes élèves ni parents : des liens privés stockés uniquement sous forme de hachage, révocables et qui expirent ; conçu pour FERPA et COPPA',
      aiDrafts:
        'L’IA suggère, l’enseignant décide : notes, analyses et e-mails aux parents restent des brouillons jusqu’à votre validation',
      schools:
        'Pour les écoles et les districts : pages d’administration, rôles et import groupé des enseignants et des élèves',
      audiences: 'Pour les enseignants, les écoles, les tuteurs et l’instruction en famille',
    },
    features: {
      'lesson-planning': {
        title: 'Planification des cours',
        description:
          "Des plans de cours hebdomadaires avec les normes Common Core, rédigés par l'IA et modifiés par vous.",
        intro:
          'Planifiez une semaine en quelques minutes et gardez tous vos plans au même endroit.',
        p1Title: "Plans hebdomadaires et plans d'anglais conversationnel",
        p1Text:
          'Objectifs, compétences, normes et activités jour par jour, dans le format que les enseignants utilisent déjà.',
        p2Title: "L'IA propose, vous décidez",
        p2Text:
          "Demandez un brouillon pour votre matière, votre niveau et votre thème ; rien n'est enregistré tant que vous ne l'avez pas modifié et enregistré.",
        p3Title: 'De vrais codes Common Core',
        p3Text:
          'Les normes proviennent de la liste officielle Common Core pour la matière et le niveau ; les codes sont vérifiés, jamais inventés.',
        p4Title: 'Modèles, dossiers et impression',
        p4Text:
          'Enregistrez des modèles, rangez vos plans dans des dossiers, dupliquez une semaine, consultez un calendrier, et imprimez ou enregistrez en PDF.',
      },
      gradebook: {
        title: 'Carnet de notes et bulletins',
        description: 'Catégories pondérées, devoirs, notes et bulletins en PDF.',
        intro: 'Des notes calculées comme votre école les compte.',
        p1Title: 'Catégories pondérées',
        p1Text:
          'Définissez les catégories et leurs poids par classe, ou partez des catégories standard.',
        p2Title: 'De vrais points, de vraies moyennes',
        p2Text:
          'Chaque devoir garde son propre maximum, et les moyennes utilisent les poids des catégories.',
        p3Title: 'Bulletins',
        p3Text:
          "Des bulletins en PDF par semestre, avec le logo de votre école et les commentaires de l'enseignant.",
        p4Title: 'Uniquement les notes confirmées',
        p4Text:
          "Les notes suggérées par l'IA restent des brouillons ; les bulletins et les familles ne voient que les notes que vous avez confirmées.",
      },
      attendance: {
        title: 'Présences',
        description:
          'Appel quotidien avec présent, absent, en retard et absence justifiée, et rapports.',
        intro: "Faites l'appel en quelques secondes et repérez les tendances dans le temps.",
        p1Title: "Une feuille d'appel rapide",
        p1Text:
          'Tout le monde est présent par défaut ; marquez les autres, avec les minutes de retard et des notes.',
        p2Title: 'Valider et rouvrir',
        p2Text: "Une journée validée est verrouillée jusqu'à ce que vous la rouvriez.",
        p3Title: 'Rapports',
        p3Text:
          'Les totaux et le taux de présence de chaque élève sur les jours que vous choisissez.',
        p4Title: 'Alimente le Centre de commande',
        p4Text:
          'Les absences et les retards comptent pour la liste des élèves à risque sur votre tableau de bord.',
      },
      'ai-tools': {
        title: "Outils d'IA",
        description:
          "Fiches d'exercices, quiz, résumés, activités, diapositives, jeux et suggestions de notes.",
        intro:
          'Une IA qui vous fait gagner du temps de rédaction et vous laisse toutes les décisions.',
        p1Title: 'Assistant IA',
        p1Text:
          "Fiches d'exercices, quiz, résumés de thèmes, activités et plans de cours dans la langue de votre choix.",
        p2Title: "Du PDF à l'évaluation en ligne",
        p2Text:
          "Téléversez une évaluation en PDF ; l'IA la découpe en questions que vous relisez avant que les élèves ne les voient.",
        p3Title: 'Suggestions de notes',
        p3Text:
          "L'IA suggère des notes et des commentaires pour les réponses ouvertes ; vous confirmez ou modifiez chacun d'eux.",
        p4Title: 'Écouter',
        p4Text:
          'Faites lire le texte à voix haute pour les élèves qui apprennent mieux en écoutant.',
      },
      presentations: {
        title: 'Présentations',
        description:
          "Des diapositives rédigées par l'IA, modifiées, présentées, imprimées ou envoyées vers Google Classroom.",
        intro: 'Préparez un diaporama pour le cours de demain en quelques minutes.',
        p1Title: "Rédigée par l'IA ou partie de zéro",
        p1Text: "Indiquez un thème, une matière et un niveau, ou partez d'un diaporama vide.",
        p2Title: 'Mises en page et thèmes',
        p2Text:
          'Mises en page titre, contenu, deux colonnes et citation, emoji, thèmes et transitions.',
        p3Title: 'Présenter et imprimer',
        p3Text: 'Présentez en plein écran, ou imprimez une diapositive par page.',
        p4Title: 'Google Slides dans Classroom',
        p4Text:
          'Envoyez une présentation vers un cours Google Classroom sous forme de diaporama Google Slides que les élèves peuvent consulter.',
      },
      workflow: {
        title: 'Un fonctionnement pensé pour les enseignants',
        description:
          "Classes, listes d'élèves, un tableau de bord quotidien, Élève 360 et l'Agent de préparation.",
        intro: "Moins de clics, plus d'enseignement.",
        p1Title: "Classes et listes d'élèves",
        p1Text:
          "Des classes avec leurs horaires, et des listes d'élèves issues d'un fichier CSV ou de Google Classroom.",
        p2Title: 'Centre de commande',
        p2Text:
          "Les classes du jour, ce qu'il reste à noter, les élèves qui pourraient avoir besoin d'aide, et les prochains cours.",
        p3Title: 'Élève 360',
        p3Text:
          "La moyenne d'un élève, ses présences, les travaux manquants, une chronologie et vos notes privées.",
        p4Title: 'Agent de préparation',
        p4Text:
          'Tapez une phrase sur la semaine prochaine et relisez une semaine complète de brouillons avant de publier.',
      },
    },
    ai: {
      metaTitle: "Fonctionnalités d'IA | TeacherHubPro",
      metaDescription:
        "Ce que l'IA de TeacherHubPro rédige, ce qu'elle reçoit, et pourquoi c'est toujours l'enseignant qui décide.",
      title: "L'IA propose, les enseignants décident",
      intro:
        "Chaque fonctionnalité d'IA de TeacherHubPro produit un brouillon. Vous relisez, modifiez et approuvez avant que quoi que ce soit n'arrive aux élèves ou aux familles.",
      listTitle: "Ce que l'IA peut rédiger",
      planner: 'Des plans de cours hebdomadaires avec les codes Common Core',
      assistant: "Fiches d'exercices, quiz, résumés et activités",
      slides: 'Des diapositives de présentation',
      extractor: "Des questions d'évaluation en ligne à partir d'un PDF",
      grader: 'Des suggestions de notes et de commentaires pour les réponses ouvertes',
      games: 'Le contenu des jeux pour chaque mode de jeu',
      paths: "Des leçons de parcours d'apprentissage avec des vérifications",
      insight: "Une courte analyse des tendances d'un élève, à partir de chiffres uniquement",
      prep: "Une semaine de plans, de diapositives, de fiches d'exercices, un quiz et un e-mail aux parents",
      principlesTitle: "Comment nous utilisons l'IA",
      principle1:
        "Ce que produit l'IA reste toujours un brouillon jusqu'à ce qu'un enseignant l'approuve.",
      principle2:
        "L'IA ne reçoit que les champs dont une tâche a besoin ; les noms des élèves ne sont pas envoyés lorsqu'ils ne sont pas nécessaires.",
      principle3:
        'Les prompts, les travaux des élèves et les données personnelles ne sont pas enregistrés dans les journaux.',
      principle4: "L'IA écrit dans la langue choisie par l'enseignant.",
      governance: "Lire notre page sur la gouvernance de l'IA",
    },
    useCasesPage: {
      title: "Cas d'usage",
      intro: "TeacherHubPro, adapté à votre façon d'enseigner.",
    },
    useCases: {
      'classroom-teachers': {
        title: 'Enseignants en classe',
        description: 'Plans, présences, notes et familles pour les enseignants en classe.',
        intro:
          "Bouclez votre planification et vos tâches administratives, et consacrez votre énergie à l'enseignement.",
        n1Title: 'Planifiez plus vite',
        n1Text:
          "Plans hebdomadaires, diapositives et fiches d'exercices rédigés par l'IA, prêts à être ajustés.",
        n2Title: "Notez avec moins d'effort",
        n2Text:
          "Des évaluations en ligne accessibles par lien, une correction automatique des questions fermées et des suggestions de l'IA pour les questions ouvertes.",
        n3Title: 'Tenez les familles informées',
        n3Text:
          'Des liens privés pour les familles affichent les notes confirmées et les présences.',
      },
      homeschool: {
        title: "Familles qui font l'école à la maison",
        description:
          "Plans, dossiers, parcours d'apprentissage et suivi des progrès pour les familles qui font l'école à la maison.",
        intro: "Une structure pour l'école à la maison, sans les tâches fastidieuses.",
        n1Title: 'Un plan pour chaque semaine',
        n1Text:
          'Des plans hebdomadaires avec les normes Common Core pour chaque matière et chaque niveau.',
        n2Title: 'Des dossiers que vous pouvez présenter',
        n2Text: 'Présences, notes et bulletins réunis au même endroit.',
        n3Title: 'Apprendre à leur rythme',
        n3Text:
          "Des parcours d'apprentissage et des jeux rédigés par l'IA, que vos enfants ouvrent depuis un lien privé.",
      },
      tutors: {
        title: 'Tuteurs',
        description: 'Supports, entraînement et suivi des progrès pour les tuteurs.',
        intro: 'Préparez vos séances rapidement et montrez clairement les progrès.',
        n1Title: 'Des supports à la demande',
        n1Text: "Fiches d'exercices, quiz et diapositives pour n'importe quel thème et niveau.",
        n2Title: "S'entraîner entre les séances",
        n2Text:
          "Attribuez des évaluations, des jeux et des parcours d'apprentissage via des liens ; aucun compte élève n'est nécessaire.",
        n3Title: 'Des progrès visibles pour les parents',
        n3Text: 'Partagez un lien famille en lecture seule avec les résultats confirmés.',
      },
      schools: {
        title: 'Écoles',
        description:
          "Un seul espace de travail pour chaque enseignant, avec des pages d'administration et l'import en masse.",
        intro:
          'Donnez à chaque enseignant les mêmes outils, et gardez les données des élèves dans une seule école.',
        n1Title: "Pages d'administration",
        n1Text:
          "Les administrateurs d'école voient leurs utilisateurs, modifient les rôles et transfèrent des classes d'un enseignant à un autre.",
        n2Title: 'Import en masse',
        n2Text: "Importez des enseignants et des listes d'élèves depuis des tableurs.",
        n3Title: 'Formule École',
        n3Text: 'Un tarif par enseignant facturé annuellement, à partir de 10 enseignants.',
      },
    },
    pricingPage: {
      metaTitle: 'Tarifs | TeacherHubPro',
      metaDescription:
        'Formules Individuelle, École et District, avec un essai gratuit de 7 jours et sans carte de paiement.',
      title: 'Tarifs',
      intro:
        'Chaque formule inclut toutes les fonctionnalités. Commencez par un essai gratuit de {days} jours ; aucune carte de paiement requise.',
      minimum: 'À partir de {count} enseignants',
      start: "Commencer l'essai gratuit",
      contactSales: 'Nous contacter',
      faqTitle: 'Questions sur les tarifs',
      faq1Q: "Que se passe-t-il à la fin de l'essai ?",
      faq1A:
        "Vous conservez vos données. Pour continuer à utiliser l'application, choisissez une formule sur la page Formules et facturation.",
      faq2Q: 'Comment fonctionnent les formules École et District ?',
      faq2A:
        'Vous payez par enseignant, avec une facturation annuelle : École à partir de 10 enseignants, District à partir de 100.',
      faq3Q: 'Comment payer ?',
      faq3A:
        'Les paiements sont gérés par Stripe. TeacherHubPro ne voit ni ne stocke jamais les numéros de carte.',
    },
    integrationsPage: {
      metaTitle: 'Intégrations | TeacherHubPro',
      metaDescription:
        'Connexion avec Google, Google Classroom, Forms, Drive et Slides, Canva, Microsoft OneDrive, Stripe et e-mail.',
      title: 'Intégrations',
      intro:
        "Les services avec lesquels TeacherHubPro fonctionne aujourd'hui, via leurs API officielles.",
    },
    enterprisePage: {
      metaTitle: 'Écoles et districts | TeacherHubPro',
      metaDescription:
        "TeacherHubPro pour les écoles et les districts : pages d'administration, import en masse et formules par enseignant.",
      title: 'Pour les écoles et les districts',
      intro:
        'Donnez à chaque enseignant le même espace de travail, avec les données des élèves conservées au sein de votre école.',
      p1Title: "Pages d'administration",
      p1Text:
        'Voyez tous les utilisateurs de votre école, modifiez les rôles, envoyez des liens de mot de passe et transférez des classes.',
      p2Title: 'Import en masse',
      p2Text:
        "Enseignants et listes d'élèves à partir de fichiers CSV, vérifiés ligne par ligne avant que quoi que ce soit ne soit créé.",
      p3Title: 'Confidentialité dès la conception',
      p3Text:
        'Des données limitées à chaque école, des liens élèves et familles hachés, des jetons Google chiffrés, et une IA qui ne fait que proposer des brouillons.',
      p4Title: 'Formules par enseignant',
      p4Text:
        'École à partir de 10 enseignants et District à partir de 100, avec facturation annuelle.',
      cta: 'Parlez-nous de votre école',
    },
    contactPage: {
      metaTitle: 'Contact | TeacherHubPro',
      metaDescription:
        "Des questions, une démonstration pour votre école ou besoin d'aide : écrivez à l'équipe TeacherHubPro.",
      title: 'Nous contacter',
      intro:
        "Des questions, une démonstration pour votre école ou besoin d'aide avec votre compte : nous lisons chaque message.",
      name: 'Votre nom',
      email: 'E-mail',
      organization: 'École ou organisation (facultatif)',
      role: 'Je suis',
      phone: 'Téléphone (facultatif)',
      interest: 'Je suis intéressé(e) par',
      message: 'Message',
      consent:
        'Nous utilisons ces informations uniquement pour vous répondre. Nous ne les vendons jamais.',
      send: 'Envoyer',
      sent: 'Merci. Nous vous répondrons bientôt.',
    },
    roles: {
      teacher: 'Enseignant(e)',
      homeschool: "Parent faisant l'école à la maison",
      tutor: 'Tuteur ou tutrice',
      school_admin: "Administrateur(trice) d'école",
      principal: "Directeur(trice) d'école",
      district: 'Responsable de district',
      parent: 'Parent',
      other: 'Autre',
    },
    interests: {
      features: 'Les fonctionnalités',
      pricing: 'Les tarifs',
      demo: 'Une démonstration',
      school: 'Une formule pour mon école',
      enterprise: 'Une formule pour un district',
      support: "De l'aide avec mon compte",
      other: 'Autre chose',
    },
    helpPage: {
      metaTitle: 'Aide | TeacherHubPro',
      metaDescription:
        'Prenez en main TeacherHubPro et trouvez des réponses aux questions fréquentes.',
      title: 'Aide',
      intro: 'Commencez ici, ou écrivez-nous depuis la page de contact.',
      startTitle: 'Premiers pas',
      step1: 'Inscrivez-vous avec votre e-mail ou votre compte Google.',
      step2:
        "Créez une classe et importez votre liste d'élèves depuis un fichier CSV ou Google Classroom.",
      step3: 'Définissez les catégories de notes et faites votre premier appel.',
      step4:
        "Demandez à l'IA un plan hebdomadaire, ou à l'Agent de préparation une semaine complète.",
      faqTitle: 'Questions fréquentes',
      faq1Q: 'Comment les élèves reçoivent-ils leur travail ?',
      faq1A:
        'Depuis un devoir, vous créez des liens privés pour chaque élève ; les élèves les ouvrent sans compte.',
      faq2Q: 'Comment les familles voient-elles les progrès ?',
      faq2A:
        "Envoyez à chaque famille un lien privé vers le portail, en lecture seule ; il n'affiche que les notes que vous avez confirmées.",
      faq3Q: "J'ai oublié mon mot de passe.",
      faq3A:
        'Utilisez « Mot de passe oublié ? » sur la page de connexion ; nous vous envoyons par e-mail un lien à usage unique.',
      faq4Q: 'Comment connecter Google Classroom ?',
      faq4A:
        'Ouvrez Outils connectés, choisissez Connecter Google Classroom, puis sélectionnez votre compte enseignant.',
    },
    chat: {
      open: 'Discuter avec Ed',
      close: 'Fermer le chat',
      title: "Ed, l'assistant IA de TeacherHubPro",
      intro:
        'Bonjour ! Je suis Ed, un assistant IA. Je peux répondre à vos questions sur les fonctionnalités et les tarifs de TeacherHubPro.',
      rolePrompt: "Qu'est-ce qui vous décrit le mieux ?",
      interestPrompt: 'Sur quoi souhaitez-vous en savoir plus ?',
      placeholder: 'Tapez votre question',
      send: 'Envoyer',
      you: 'Vous',
      ed: 'Ed',
      thinking: "Ed est en train d'écrire…",
      failed:
        "Désolé, je n'ai pas pu répondre à cette question. Réessayez, ou utilisez la page de contact.",
      limit:
        "Ce chat a atteint sa limite. Veuillez utiliser la page de contact pour joindre l'équipe.",
      leadPrompt: "Vous souhaitez que l'équipe vous recontacte ? Laissez vos coordonnées.",
      leadOpen: 'Laisser mes coordonnées',
      leadSent: "Merci ! L'équipe vous contactera.",
      aiNote:
        "Les réponses proviennent d'une IA et peuvent être erronées ; les prix de la page Tarifs font référence.",
    },
    leads: {
      title: 'Prospects',
      intro:
        'Les personnes qui ont laissé leurs coordonnées dans le chat du site ou le formulaire de contact.',
      score_high: 'Élevée',
      score_medium: 'Moyenne',
      score_low: 'Faible',
      source_chat: 'Chat',
      source_contact: 'Formulaire de contact',
      status_new: 'Nouveau',
      status_contacted: 'Contacté',
      status_closed: 'Clôturé',
      search: 'Rechercher par nom, e-mail ou organisation',
      score: 'Priorité',
      source: 'Source',
      status: 'Statut',
      all: 'Tous',
      filter: 'Filtrer',
      empty: 'Aucun prospect pour le moment.',
      received: 'Reçu',
      saveStatus: 'Enregistrer le statut',
      statusFor: 'Statut de {name}',
    },
  },
  legal: {
    updated: 'Dernière mise à jour : {date}',
    contact: 'Des questions sur cette page ? Écrivez-nous depuis la page de contact.',
    privacy: {
      title: 'Politique de confidentialité',
      description:
        'Quelles données TeacherHubPro conserve, pourquoi, et comment elles sont protégées.',
      s1Title: 'Qui est concerné',
      s1Text:
        "Cette politique concerne les enseignants, le personnel des écoles et les parents faisant l'école à la maison qui utilisent TeacherHubPro, ainsi que les informations sur les élèves et les familles qu'ils saisissent. Les élèves et les familles ne créent pas de compte ; ils utilisent des liens privés qu'un enseignant leur donne.",
      s2Title: 'Ce que nous conservons',
      s2Text:
        "Les informations de compte (nom, e-mail, école, langue), ce que créent les enseignants (classes, plans, devoirs, notes, présences, remarques) et ce que les élèves soumettent via leurs liens. Les dossiers des élèves ne contiennent que ce dont une fonctionnalité a besoin : les noms, un numéro d'élève facultatif, un e-mail de parent facultatif et des aménagements facultatifs.",
      s3Title: 'Comment nous les utilisons',
      s3Text:
        "Uniquement pour faire fonctionner le service pour l'école ou l'enseignant qui les a saisies. Nous ne vendons pas de données personnelles et n'utilisons pas les données des élèves à des fins publicitaires.",
      s4Title: 'Avec qui nous les partageons',
      s4Text:
        "Les prestataires qui font fonctionner l'application : notre hébergeur et fournisseur de base de données, Stripe pour les paiements, un fournisseur d'e-mail pour les messages, Anthropic (Claude) pour les brouillons de l'IA, OpenAI pour l'audio de lecture à voix haute, Google lorsqu'un enseignant connecte Google Classroom, Canva lorsqu'un enseignant connecte Canva (uniquement la présentation ou la fiche qu'il y ouvre, jamais de données d'élèves), et Microsoft lorsqu'un enseignant connecte Microsoft (uniquement les fichiers qu'il enregistre dans OneDrive, jamais de données d'élèves). Chacun ne reçoit que ce dont sa tâche a besoin.",
      s5Title: 'Comment elles sont protégées',
      s5Text:
        "Les mots de passe sont stockés sous forme de hachages à sens unique. Les liens de session, d'élève, de famille et de mot de passe sont aléatoires et stockés uniquement sous forme de hachages. Les jetons Google Classroom, Canva et Microsoft sont chiffrés. Chaque donnée appartient à une seule école et n'est accessible qu'aux utilisateurs de cette école. Le lien de calendrier d'un enseignant est lui aussi aléatoire et stocké uniquement sous forme de hachage : il ne montre que les titres des plans et des devoirs avec leurs dates, jamais d'informations sur les élèves, et l'enseignant peut le remplacer ou le désactiver dans les Paramètres.",
      s6Title: 'Conservation et suppression des données',
      s6Text:
        'Les données sont conservées tant que le compte est actif. Les PDF téléversés sont supprimés une fois lus. Les conversations du chat du site sont supprimées après 30 jours. Pour demander une copie ou la suppression de vos données, écrivez-nous depuis la page de contact.',
    },
    terms: {
      title: "Conditions d'utilisation",
      description: "Les conditions d'utilisation de TeacherHubPro.",
      s1Title: 'Le service',
      s1Text:
        "TeacherHubPro est une application web pour l'enseignement : planification, classes, présences, notes, devoirs, outils de rédaction par IA et portails des familles.",
      s2Title: 'Votre compte',
      s2Text:
        "Les comptes sont réservés aux adultes : enseignants, personnel scolaire, tuteurs et parents. Les élèves n'ont pas de compte ; ils utilisent les liens privés que leur enseignant leur transmet. Protégez votre mot de passe, utilisez l'application pour enseigner et apprendre, et respectez les règles d'utilisation acceptable. Vous êtes responsable du contenu que vous créez et des informations sur les élèves que vous saisissez, ainsi que de disposer du droit de les saisir.",
      s3Title: "Brouillons de l'IA",
      s3Text:
        "Les fonctionnalités d'IA produisent des brouillons qui peuvent contenir des erreurs. Vous les relisez et les approuvez avant de les utiliser ; les notes et les rapports ne comptent qu'une fois que vous les avez confirmés.",
      s4Title: 'Formules et paiement',
      s4Text:
        "Les nouveaux comptes bénéficient d'un essai gratuit de 7 jours. Les formules payantes se renouvellent jusqu'à leur résiliation ; les prix figurent sur la page Tarifs. Les paiements sont traités par Stripe.",
      s5Title: 'Votre contenu',
      s5Text:
        'Vous conservez les droits sur ce que vous créez. Vous nous autorisez à le stocker et à le traiter uniquement pour vous fournir le service.',
      s6Title: 'Modifications',
      s6Text:
        'Nous pouvons mettre à jour ces conditions ; la date de la dernière version sera indiquée sur cette page.',
    },
    cookies: {
      title: 'Cookies',
      description: 'Les cookies utilisés par TeacherHubPro.',
      s1Title: "Uniquement ce dont l'application a besoin",
      s1Text:
        "TeacherHubPro utilise quelques cookies pour fonctionner. Nous n'utilisons aucun cookie publicitaire ni de suivi.",
      s2Title: 'Les cookies',
      s2Text:
        "thp_session vous garde connecté (30 jours). thp_oauth_state protège la connexion avec Google et la connexion à Classroom pendant qu'elles ont lieu. thp_tz mémorise votre fuseau horaire pour que « aujourd'hui » corresponde à votre journée. thp_tour_seen mémorise que vous avez fermé la visite de bienvenue.",
      s3Title: 'Le chat du site',
      s3Text:
        "Le chat du site conserve sa clé de conversation uniquement dans l'onglet de votre navigateur, et elle prend fin lorsque vous fermez l'onglet.",
    },
    accessibility: {
      title: 'Accessibilité',
      description: "Comment TeacherHubPro progresse vers l'accessibilité.",
      s1Title: 'Notre objectif',
      s1Text:
        "Nous visons à ce que TeacherHubPro respecte le niveau AA des WCAG 2, afin que chaque enseignant, élève et famille puisse l'utiliser.",
      s2Title: 'Ce que nous faisons',
      s2Text:
        "Les pages sont testées automatiquement pour détecter les problèmes WCAG 2 de niveaux A et AA à chaque modification. L'application fonctionne au clavier, utilise des formulaires et des titres étiquetés, suit votre réglage clair ou sombre, et peut lire le texte à voix haute.",
      s3Title: 'Signalez-nous un problème',
      s3Text:
        "Si quelque chose est difficile à utiliser, écrivez-nous depuis la page de contact en nous indiquant la page et ce qui s'est passé.",
    },
    acceptableUse: {
      title: 'Utilisation acceptable',
      description: 'Ce pour quoi TeacherHubPro peut et ne peut pas être utilisé.',
      s1Title: 'Utilisez-le pour enseigner',
      s1Text:
        'Utilisez TeacherHubPro pour planifier, enseigner, évaluer et communiquer avec les familles.',
      s2Title: 'À ne pas faire',
      s2Text:
        "Ne saisissez pas d'informations sur des élèves que vous n'êtes pas autorisé à partager, ne tentez pas d'accéder aux données d'une autre école, ne partagez pas publiquement les liens privés des élèves ou des familles, ne surchargez pas et n'attaquez pas le service, n'utilisez pas les outils d'IA pour créer des contenus nuisibles, illégaux ou sans rapport, et ne l'utilisez pas en tant qu'élève pour faire vos propres devoirs.",
      s3Title: 'En cas de non-respect des règles',
      s3Text:
        'Nous pouvons suspendre un accès qui met en danger des élèves, des écoles ou le service.',
    },
    ferpa: {
      title: 'FERPA',
      description: 'Comment TeacherHubPro traite les dossiers scolaires.',
      s1Title: 'Dossiers scolaires',
      s1Text:
        "Les notes, les présences, les devoirs et les remarques que saisissent les enseignants sont des dossiers scolaires. Nous les traitons uniquement pour fournir le service à l'école ou à l'enseignant, selon leurs instructions.",
      s2Title: 'Accès',
      s2Text:
        "Les dossiers ne sont accessibles qu'aux utilisateurs de l'école à laquelle ils appartiennent. Les familles voient les notes confirmées et les présences de leur propre enfant via un lien privé.",
      s3Title: 'Aucune autre utilisation',
      s3Text:
        'Nous ne vendons pas les dossiers scolaires et ne les utilisons pas à des fins publicitaires.',
    },
    coppa: {
      title: 'Confidentialité des enfants (COPPA)',
      description: 'Comment TeacherHubPro protège les informations des enfants.',
      s1Title: 'Aucun compte élève',
      s1Text:
        "Les élèves ne s'inscrivent pas et ne nous fournissent pas directement d'informations personnelles. Les enseignants, les écoles et les parents saisissent les informations dont une fonctionnalité a besoin, et les élèves utilisent des liens privés.",
      s2Title: 'Uniquement le nécessaire',
      s2Text:
        "Nous ne collectons que ce dont une fonctionnalité a besoin, n'envoyons à l'IA que ce dont une tâche a besoin, et n'utilisons jamais les informations des enfants à des fins publicitaires.",
      s3Title: 'Parents',
      s3Text:
        "Les parents peuvent demander à l'enseignant ou à l'école de leur enfant de consulter ou de supprimer les informations de leur enfant, ou nous écrire depuis la page de contact.",
    },
    aiGovernance: {
      title: "Gouvernance de l'IA",
      description: "Les règles que suivent les fonctionnalités d'IA de TeacherHubPro.",
      s1Title: 'Uniquement des brouillons',
      s1Text:
        "Les notes de l'IA, les analyses sur les élèves, les plans, les lots de préparation et les e-mails aux parents sont des brouillons jusqu'à ce qu'un enseignant les approuve. Les bulletins, le total du carnet de notes et les portails des familles n'affichent que les notes confirmées par l'enseignant.",
      s2Title: 'Le minimum de données',
      s2Text:
        "Chaque tâche d'IA ne reçoit que les champs dont elle a besoin. Les analyses sur les élèves reçoivent des chiffres et des titres de devoirs, pas de noms. Les prompts, les travaux des élèves et les données personnelles ne sont pas enregistrés dans les journaux.",
      s3Title: 'Aucun fait inventé',
      s3Text:
        "L'IA a pour consigne de ne pas inventer de notes, de présences, de codes de normes, de prix ni de fonctionnalités, et ses réponses sont vérifiées : par exemple, les codes de normes doivent exister et le chat du site ne peut indiquer que des prix réels.",
      s4Title: "Transparence sur l'IA",
      s4Text: "Le chat du site est un assistant IA et le dit lorsqu'on le lui demande.",
      s5Title: 'Fournisseurs',
      s5Text:
        "Les brouillons de l'IA sont réalisés avec Claude d'Anthropic ; l'audio de lecture à voix haute avec OpenAI.",
    },
    trust: {
      title: 'Centre de confiance',
      description:
        'Comment TeacherHubPro protège les écoles, les enseignants, les élèves et les familles.',
      s1Title: 'Conçu pour les données de mineurs',
      s1Text:
        'Les élèves et les familles utilisent des liens privés au lieu de comptes. Les liens sont aléatoires, stockés uniquement sous forme de hachages, révocables, et expirent.',
      s2Title: 'Cloisonnement par école',
      s2Text:
        "Chaque donnée appartient à une seule école, et chaque action vérifie l'école et le rôle de l'utilisateur.",
      s3Title: 'Secrets et mots de passe',
      s3Text:
        'Les mots de passe sont hachés ; les jetons Google sont chiffrés ; les secrets ne sont jamais enregistrés dans les journaux ; le code est analysé à chaque modification pour détecter les fuites de secrets.',
      s4Title: 'Une IA encadrée',
      s4Text:
        "L'IA ne fait que proposer des brouillons, ne reçoit que ce dont une tâche a besoin, et est contrôlée pour éviter les faits inventés. Consultez la page sur la gouvernance de l'IA.",
      s5Title: 'Accords',
      s5Text:
        "Besoin d'un accord de traitement des données ou d'une question de sécurité pour votre école ? Écrivez-nous depuis la page de contact.",
    },
  },
};
