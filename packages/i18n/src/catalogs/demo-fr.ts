import type { DemoMessages } from './marketing-types.ts';

// The product tour on /demo, in French.
export const demoFr: DemoMessages = {
  demo: {
    metaTitle: 'Démo TeacherHubPro : découvrez chaque fonctionnalité, étape par étape',
    metaDescription:
      'Une visite guidée de TeacherHubPro avec de vrais écrans : plans de cours, présences, correction avec l’IA, jeux, jeux en direct, portail des familles et plus encore.',
    title: 'Découvrez TeacherHubPro, étape par étape',
    intro:
      'Une visite guidée de toute l’application en {steps} étapes, avec de vrais écrans. Tous les élèves que vous voyez sont fictifs.',
    contents: 'Chapitres',
    chapterNumber: 'Chapitre {n}',
    enlarge: 'Ouvrir la capture d’écran en taille réelle : {title}',
    madeUp:
      'Les noms, classes et notes de ces captures d’écran sont fictifs. Les brouillons IA ont été rédigés par l’IA de l’application et sont montrés tels quels.',
    chapters: {
      start: {
        title: 'Premiers pas',
        intro: 'Inscrivez-vous en une minute et commencez avec une classe exemple toute prête.',
      },
      classes: {
        title: 'Classes, listes d’élèves et présences',
        intro: 'Importez vos élèves depuis un tableur et faites l’appel en quelques secondes.',
      },
      planning: {
        title: 'Planification des cours',
        intro:
          'Des plans hebdomadaires alignés sur le Common Core et les normes de Porto Rico, prêts à imprimer.',
      },
      assistant: {
        title: 'Assistant IA',
        intro:
          'Fiches d’exercices, quiz et grilles d’évaluation rédigés pour votre niveau et votre thème. Vous modifiez et décidez.',
      },
      presentations: {
        title: 'Présentations',
        intro:
          'Des diapositives rédigées par l’IA, prêtes à présenter ou à ouvrir dans Google Slides, Canva ou OneDrive.',
      },
      prep: {
        title: 'Agent de préparation',
        intro: 'Une phrase devient une semaine entière, et vous vérifiez tout avant l’envoi.',
      },
      assignments: {
        title: 'Devoirs et correction par l’IA',
        intro:
          'Transformez un PDF en devoir en ligne, partagez-le par lien et confirmez les notes suggérées par l’IA.',
      },
      gradebook: {
        title: 'Carnet de notes et bulletins',
        intro:
          'Catégories pondérées, semestres et bulletins, à partir des notes que vous avez confirmées.',
      },
      games: {
        title: 'Jeux éducatifs',
        intro: 'Onze modes de jeu, une explication pour chaque réponse et le suivi des normes.',
      },
      live: {
        title: 'Jeux en direct en classe',
        intro:
          'Jouez ensemble sur grand écran pendant que les élèves répondent sur leur téléphone.',
      },
      learning: {
        title: 'Apprentissage adaptatif et suivi des élèves',
        intro:
          'Des parcours personnalisés et les premiers signes de qui pourrait avoir besoin d’aide.',
      },
      families: {
        title: 'Portail des familles',
        intro:
          'Les familles consultent notes et présences grâce à un lien privé, sans créer de compte.',
      },
      substitutes: {
        title: 'Dossiers pour remplaçants',
        intro: 'Tout ce dont un remplaçant a besoin, imprimé en un clic.',
      },
      connections: {
        title: 'Outils connectés',
        intro:
          'Fonctionne avec Google, Microsoft, Canva et la plateforme de cours de votre établissement.',
      },
      schools: {
        title: 'Pour les écoles et les districts',
        intro:
          'Utilisation, réglages, un registre des décisions de l’IA et vos données, au même endroit.',
      },
    },
    steps: {
      signup: {
        title: 'Créez votre compte',
        text: 'Inscrivez-vous avec votre e-mail ou votre compte Google. Votre essai gratuit commence tout de suite, sans carte bancaire.',
        alt: 'La page d’inscription de TeacherHubPro avec les champs nom, e-mail et mot de passe.',
      },
      commandCenter: {
        title: 'Votre Centre de commande',
        text: 'Chaque matin, vous voyez les cours du jour, les travaux à corriger et les élèves qui pourraient avoir besoin d’aide, sur un seul écran.',
        alt: 'Le Centre de commande avec les cours du jour, les travaux à corriger et un élève qui pourrait avoir besoin d’aide.',
      },
      sampleClass: {
        title: 'Essayez avec une classe exemple',
        text: 'En un clic, ajoutez une classe exemple avec des élèves, des notes et des présences fictifs, pour tout essayer avant d’ajouter vos propres classes. Supprimez-la quand vous voulez.',
        alt: 'La page de la classe exemple avec six élèves fictifs.',
      },
      rosterImport: {
        title: 'Importez votre liste d’élèves',
        text: 'Téléversez un tableur avec les prénoms et les noms. Numéros d’élève, e-mails des parents, aménagements et langue de la famille sont des colonnes facultatives.',
        alt: 'Une liste de classe après l’import des élèves depuis un tableur.',
      },
      accommodations: {
        title: 'Tous les aménagements au même endroit',
        text: 'Notez une seule fois les aménagements de chaque élève. Ils apparaissent là où ils comptent, comme dans le dossier pour remplaçant, et restent réservés à vous et à votre établissement.',
        alt: 'La fiche d’un élève avec le champ des aménagements rempli.',
      },
      attendance: {
        title: 'Faites l’appel en quelques secondes',
        text: 'Indiquez présent, absent, en retard ou excusé pour chaque élève, ajoutez les minutes de retard et enregistrez la journée.',
        alt: 'La feuille d’appel avec un statut pour chaque élève.',
      },
      attendanceReport: {
        title: 'Les présences en un coup d’œil',
        text: 'Le rapport de présences montre le taux de chaque élève ainsi que chaque absence et chaque retard sur les dates choisies.',
        alt: 'Le rapport de présences avec le taux de présence de chaque élève.',
      },
      planner: {
        title: 'Planifiez votre semaine avec les normes',
        text: 'Rédigez votre plan hebdomadaire jour par jour et choisissez les normes dans les listes officielles du Common Core et de Porto Rico. L’application n’invente jamais de code de norme.',
        alt: 'Le planificateur hebdomadaire avec le sélecteur des normes de Porto Rico ouvert.',
      },
      planPrint: {
        title: 'Imprimez au format de votre établissement',
        text: 'Imprimez vos plans au format classique avec l’en-tête de votre établissement, ou dans un format simple d’une page.',
        alt: 'Un plan de cours hebdomadaire prêt à imprimer au format classique.',
      },
      curriculum: {
        title: 'Ajoutez vos guides de programme',
        text: 'Téléversez ou collez les progressions de votre établissement. L’IA les suit pour rédiger les plans, afin qu’ils correspondent à ce que vous enseignez.',
        alt: 'La page des guides de programme avec une progression prête à l’emploi.',
      },
      templates: {
        title: 'Partez d’un modèle',
        text: 'Commencez un plan à partir d’une unité toute prête ou de l’un de vos modèles, puis modifiez ce que vous voulez.',
        alt: 'La page des modèles avec des unités toutes prêtes.',
      },
      assistantForm: {
        title: 'Demandez à l’assistant IA',
        text: 'Choisissez une fiche d’exercices, un quiz ou un plan de cours, puis la matière, le niveau, le thème et la langue. Cochez Soutien ESL pour du matériel adapté aux élèves qui apprennent l’anglais, selon WIDA et les normes de Porto Rico.',
        alt: 'Le formulaire de l’assistant IA avec le type, le thème, le niveau et le soutien ESL.',
      },
      assistantResult: {
        title: 'Relisez le brouillon',
        text: 'Le brouillon est prêt en quelques secondes. Copiez-le, imprimez-le, faites-le lire à voix haute, ouvrez-le dans Canva ou enregistrez-le sur OneDrive.',
        alt: 'Une fiche d’exercices rédigée par l’assistant IA.',
      },
      rubric: {
        title: 'Créez des grilles d’évaluation',
        text: 'Partez de zéro ou laissez l’IA rédiger une grille, puis modifiez chaque critère et chaque niveau. Utilisez-la pour corriger les réponses écrites.',
        alt: 'Une grille d’évaluation avec critères et niveaux, prête à modifier.',
      },
      presentation: {
        title: 'Rédigez une présentation',
        text: 'Indiquez un thème et le nombre de diapositives, choisissez un style et modifiez chaque diapositive avant de présenter.',
        alt: 'Une présentation rédigée par l’IA, ouverte dans l’éditeur de diapositives.',
      },
      presentationExport: {
        title: 'Présentez où vous voulez',
        text: 'Présentez depuis le navigateur, téléchargez en PowerPoint, envoyez vers Google Classroom et Slides, ouvrez dans Canva ou enregistrez sur OneDrive.',
        alt: 'Les options d’une présentation pour l’envoyer vers Google Classroom, Canva et OneDrive.',
      },
      prepStart: {
        title: 'Une phrase, une semaine entière',
        text: 'Écrivez ce que vous enseignez cette semaine. L’Agent de préparation rédige le plan, les diapositives et les fiches de chaque jour, un quiz pour vendredi et un mot pour les familles.',
        alt: 'Le formulaire de l’Agent de préparation avec une phrase qui décrit la semaine.',
      },
      prepReview: {
        title: 'Vous vérifiez avant tout envoi',
        text: 'Lisez chaque élément, gardez-le ou retirez-le, et modifiez l’e-mail aux familles. Rien n’est publié ni envoyé sans votre accord.',
        alt: 'La vérification de l’Agent de préparation avec le plan de la semaine, les fiches, le quiz et l’e-mail aux familles.',
      },
      pdfImport: {
        title: 'Transformez un PDF en devoir en ligne',
        text: 'Téléversez une fiche ou un contrôle en PDF. L’IA en extrait les questions dans un éditeur où vous vérifiez chacune avant d’enregistrer.',
        alt: 'Des questions importées d’un PDF, prêtes à vérifier et à enregistrer.',
      },
      studentLinks: {
        title: 'Partagez avec les liens des élèves',
        text: 'Chaque élève reçoit un lien privé : aucun compte ni mot de passe à gérer. Vous pouvez remplacer ou désactiver un lien à tout moment.',
        alt: 'La page des liens des élèves avec un lien pour chaque élève.',
      },
      studentAnswer: {
        title: 'Les élèves répondent sur n’importe quel appareil',
        text: 'Les élèves ouvrent leur lien sur un téléphone, une tablette ou un ordinateur, répondent et rendent leur travail. Les questions peuvent être lues à voix haute.',
        alt: 'Un élève qui répond à un devoir sur un téléphone.',
      },
      aiGrading: {
        title: 'L’IA suggère, vous décidez',
        text: 'Les questions à choix se corrigent toutes seules. Pour les réponses écrites, l’IA suggère une note et un commentaire, et rien ne compte tant que vous ne l’avez pas confirmé ou modifié.',
        alt: 'La réponse d’un élève avec une note suggérée par l’IA, en attente de confirmation par l’enseignant.',
      },
      gradebook: {
        title: 'Un carnet de notes qui fait les calculs',
        text: 'Des catégories pondérées, la moyenne générale de chaque élève, et uniquement les notes que vous avez confirmées.',
        alt: 'Le carnet de notes avec les catégories et la moyenne générale de chaque élève.',
      },
      reportCards: {
        title: 'Des bulletins en quelques minutes',
        text: 'Ajoutez une appréciation pour chaque élève et téléchargez les bulletins en PDF, un par un ou pour toute la classe.',
        alt: 'Des bulletins avec les notes par catégorie et l’appréciation de l’enseignant.',
      },
      gameBuilder: {
        title: 'Créez un jeu en quelques minutes',
        text: 'Écrivez vos propres questions ou laissez l’IA les rédiger, puis choisissez parmi onze modes, comme Quiz, Contre la montre, Association, Memory et Mots croisés.',
        alt: 'Le créateur de jeux avec des cartes de questions.',
      },
      gameReview: {
        title: 'Les élèves comprennent pourquoi',
        text: 'Après une partie, les élèves revoient les questions manquées avec la bonne réponse et une courte explication.',
        alt: 'Le bilan d’un élève après un jeu, avec les bonnes réponses et les explications.',
      },
      aiExplanations: {
        title: 'Des explications rédigées pour vous',
        text: 'En un clic, l’IA rédige un court « pourquoi » pour chaque carte qui n’en a pas. Vous les lisez et les modifiez avant d’enregistrer.',
        alt: 'Des explications rédigées par l’IA, prêtes à être vérifiées par l’enseignant.',
      },
      coverage: {
        title: 'Voyez les normes que vous avez couvertes',
        text: 'Le rapport de couverture montre les résultats de la classe pour chaque norme indiquée, avec un clic pour retravailler ce qui en a besoin.',
        alt: 'Le rapport de couverture des normes d’une classe.',
      },
      liveLobby: {
        title: 'Lancez un jeu en direct',
        text: 'Affichez le jeu sur grand écran. Les élèves rejoignent la partie avec un PIN à 6 chiffres et touchent leur nom dans votre liste.',
        alt: 'La salle d’attente du jeu en direct avec le PIN et les élèves qui ont rejoint.',
      },
      livePlayer: {
        title: 'Les élèves jouent sur leur téléphone',
        text: 'Chaque élève répond sur son propre appareil, contre la montre, avec des points pour la rapidité et les séries.',
        alt: 'Un élève qui répond à une question d’un jeu en direct sur un téléphone.',
      },
      liveReveal: {
        title: 'Révéler, expliquer, continuer',
        text: 'Après chaque question, le grand écran montre la bonne réponse, les réponses de la classe et l’explication, puis le classement.',
        alt: 'Le grand écran avec la bonne réponse, les réponses de la classe et l’explication.',
      },
      learningPath: {
        title: 'Des parcours d’apprentissage personnalisés',
        text: 'Rédigez une courte série de leçons pour un élève, sur le sujet dont il a besoin. Vous la modifiez, puis l’attribuez à son lien.',
        alt: 'Un parcours d’apprentissage rédigé pour un élève, ouvert dans l’éditeur.',
      },
      studentLesson: {
        title: 'Des leçons au rythme de chaque élève',
        text: 'L’élève lit chaque leçon, répond à une petite vérification et voit son score. Vous suivez sa progression.',
        alt: 'Un élève qui suit une leçon sur un téléphone.',
      },
      insights: {
        title: 'Repérez qui pourrait avoir besoin d’aide',
        text: 'La page de chaque élève réunit notes, présences et observations. Un résumé de l’IA propose des pistes que vous pouvez envisager.',
        alt: 'La page d’un élève avec ses notes, ses présences et un résumé de l’IA.',
      },
      parentPortal: {
        title: 'Tenez les familles informées',
        text: 'Les familles ouvrent un lien privé pour voir les notes confirmées et les présences. Les mots hebdomadaires de l’Agent de préparation peuvent être envoyés à chaque famille dans sa langue.',
        alt: 'Le portail des familles sur un téléphone avec les notes et les présences.',
      },
      subPacket: {
        title: 'Soyez prêt pour un remplaçant',
        text: 'Le dossier pour remplaçant réunit votre emploi du temps, votre liste d’élèves, vos plans, vos routines et vos contacts, prêt à imprimer.',
        alt: 'Un dossier pour remplaçant avec l’emploi du temps, la liste d’élèves et les routines.',
      },
      integrations: {
        title: 'Connectez vos outils',
        text: 'Connectez Google Classroom, Google Drive, Microsoft OneDrive et Teams, Canva et votre agenda. Vous choisissez ce qui est partagé, outil par outil.',
        alt: 'La page Outils connectés avec Google, Microsoft et Canva.',
      },
      schoolSystems: {
        title: 'La plateforme de cours de votre établissement',
        text: 'Les établissements peuvent ouvrir TeacherHubPro dans Canvas, Schoology, Moodle et D2L Brightspace et y renvoyer les notes confirmées, grâce au standard LTI 1.3. Disponible sur demande.',
        alt: 'La section des systèmes de l’établissement dans Outils connectés.',
      },
      schoolOverview: {
        title: 'La vue d’ensemble de l’école',
        text: 'Les chefs d’établissement voient comment chaque enseignant utilise l’application et peuvent activer ou désactiver les fonctions IA et les signalements d’élèves pour toute l’école.',
        alt: 'La vue d’ensemble de l’école avec l’utilisation par enseignant et les réglages pour toute l’école.',
      },
      schoolUsers: {
        title: 'Gérez les utilisateurs de l’école',
        text: 'Attribuez le bon rôle aux enseignants et aux administrateurs, et confiez une classe à un autre enseignant quand quelqu’un part.',
        alt: 'La page des utilisateurs de l’école avec les rôles.',
      },
      approvals: {
        title: 'Un registre de chaque décision de l’IA',
        text: 'Le travail de l’IA n’atteint les élèves et les familles qu’après l’approbation d’un enseignant. Le registre des approbations montre qui a approuvé quoi et quand, sans noms ni notes d’élèves.',
        alt: 'Le registre des approbations avec ce que les enseignants ont approuvé.',
      },
      dataExport: {
        title: 'Vos données restent les vôtres',
        text: 'Téléchargez toutes les données de votre école à tout moment, ou supprimez vous-même l’école et ses données.',
        alt: 'La page des paramètres avec le téléchargement et la suppression des données de l’école.',
      },
      languages: {
        title: 'Sept langues',
        text: 'Utilisez l’application en anglais, espagnol, français, portugais, allemand, italien ou chinois. L’IA écrit dans la langue que vous choisissez.',
        alt: 'La page des paramètres avec le choix de la langue.',
      },
    },
  },
};
