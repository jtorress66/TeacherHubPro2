// The public website's copy: marketing pages, the website chat and the legal pages. Every claim
// here must be true of the app today; add a feature only when it ships.

export const marketingEn = {
  marketing: {
    nav: {
      label: 'Main',
      features: 'Features',
      useCases: 'Use cases',
      pricing: 'Pricing',
      freeTools: 'Free tools',
      contact: 'Contact',
      logIn: 'Log in',
      startTrial: 'Start free trial',
    },
    footer: {
      tagline: 'The AI teaching workspace for teachers, schools and homeschool families.',
      product: 'Product',
      useCases: 'Use cases',
      company: 'Company',
      legal: 'Legal and trust',
      ai: 'AI features',
      integrations: 'Integrations',
      enterprise: 'Schools and districts',
      help: 'Help',
      rights: '© {year} TeacherHubPro',
    },
    landing: {
      metaTitle: 'TeacherHubPro: your AI teaching workspace',
      metaDescription:
        'Plan lessons, take attendance, grade, make slides, games and quizzes, and share progress with families, with AI that drafts and you decide. Free 7-day trial.',
      featuresTitle: 'Everything a teaching week needs',
      featuresIntro: 'One workspace for planning, teaching, grading and families.',
      howTitle: 'How it works',
      how1Title: 'Set up your classes',
      how1Text: 'Add a class and import your roster from a spreadsheet, or from Google Classroom.',
      how2Title: 'Let the AI draft',
      how2Text:
        'Ask for a weekly plan, slides, a worksheet, a quiz or a whole week of prep. Every result is a draft.',
      how3Title: 'Review and use it',
      how3Text:
        'Edit anything, then teach, assign, grade and share. Nothing reaches students or families until you approve it.',
      whoTitle: 'Made for',
      whoIntro: 'Classroom teachers, homeschool families, tutors and whole schools.',
      trustTitle: 'Student data, handled carefully',
      trustIntro: 'Students are minors, and the app is built around that.',
      trust1:
        'Students and parents use private links, not accounts. Links are random, stored only as hashes, and can be revoked.',
      trust2: 'Every record belongs to one school, and only that school’s teachers can reach it.',
      trust3: 'The AI is sent only what a task needs. Student insights get numbers, never a name.',
      trust4: 'AI grades and suggestions stay drafts until a teacher confirms them.',
      trustMore: 'Visit the trust center',
      pricingTitle: 'Simple pricing',
      pricingIntro: 'Start with a free {days}-day trial. No payment card needed.',
      pricingSee: 'See all plans',
      faqTitle: 'Questions',
      faq1Q: 'Do I need a payment card for the trial?',
      faq1A:
        'No. The trial gives you full access for 7 days; you choose a plan only if you want to keep going.',
      faq2Q: 'Does the AI grade for me?',
      faq2A:
        'It suggests scores and feedback for open answers. You confirm every grade before it counts.',
      faq3Q: 'Which languages does it support?',
      faq3A:
        'TeacherHubPro is fully available in seven languages: English, Spanish, French, Portuguese, German, Italian and Chinese, and the AI writes in the language you choose.',
      faq4Q: 'Does it work with Google Classroom?',
      faq4A:
        'Yes. You can import rosters, post assignments and Word documents, send presentations as Google Slides, and make Google Forms quizzes.',
      faq5Q: 'Can my whole school use it?',
      faq5A:
        'Yes. The School and District plans add teachers to one school with admin pages and bulk import.',
      ctaTitle: 'Try it with your own classes',
      ctaText: 'Set up a class in minutes and let the AI draft your next week.',
    },
    freeTools: {
      metaTitle: 'Free teacher tools: grade calculator, group maker and rubric maker',
      metaDescription:
        'Free tools for teachers, no sign-up: a weighted grade calculator, a random group maker and name picker, and a printable rubric maker.',
      title: 'Free tools for teachers',
      intro: 'Use them right away, no account needed.',
      open: 'Open',
      privacy: 'Everything stays on your computer: nothing you type here is sent to us or saved.',
      more: 'More free tools',
      gradeName: 'Grade calculator',
      gradeMetaTitle: 'Free weighted grade calculator for teachers',
      gradeMetaDescription:
        'Work out a weighted final grade from categories and scores, with the letter grade and GPA. Free, no sign-up.',
      gradeSummary: 'Weighted categories in; final percent, letter grade and GPA out.',
      gradeIntro:
        'Add each category with its weight and type the scores. The final grade updates as you type.',
      category: 'Category {n}',
      name: 'Name',
      weight: 'Weight (%)',
      scores: 'Scores',
      scoresHint: 'One per line, like 18/20, 85 or 92%.',
      unread: '{count} could not be read and are left out.',
      addCategory: 'Add category',
      removeCategory: 'Remove category',
      result: 'Final grade',
      average: 'Average: {percent}%',
      noScores: 'No scores yet',
      letter: 'Letter grade',
      gpa: 'GPA (4.0 scale)',
      empty: 'Type some scores to see the grade.',
      weightWarning:
        'The weights add up to {total}%, not 100%, so each category counts in proportion to its weight.',
      gradeCta:
        "TeacherHubPro's gradebook works this out for every student as you enter grades, and fills in report cards.",
      groupName: 'Random group maker',
      groupMetaTitle: 'Free random group maker and name picker',
      groupMetaDescription:
        'Paste your class list to make random groups or pick a student at random. Free, no sign-up, and names never leave your computer.',
      groupSummary: 'Paste a class list, then make random groups or pick a name.',
      groupIntro:
        'Paste the names, choose how to split them and press the button. Press it again for new groups.',
      names: 'Names',
      namesHint: 'One per line, or separated by commas.',
      namesCount: '{count} names',
      splitBy: 'Split by',
      byCount: 'Number of groups',
      bySize: 'People per group',
      howMany: 'How many',
      make: 'Make groups',
      group: 'Group {n}',
      pick: 'Pick a name',
      picked: 'Picked: {name}',
      groupCta:
        'In TeacherHubPro your class lists are already there for attendance, grades and live games.',
      rubricName: 'Rubric maker',
      rubricMetaTitle: 'Free rubric maker: build and print a rubric',
      rubricMetaDescription:
        'Make a scoring rubric with your own criteria and levels, then print it or copy it. Free, no sign-up.',
      rubricSummary: 'Criteria and levels in a grid you can print or copy.',
      rubricIntro:
        'Name your criteria and levels, describe each box, then print or copy the rubric.',
      rubricTitle: 'Rubric title',
      rubricTitleDefault: 'My rubric',
      print: 'Print',
      copy: 'Copy as text',
      copied: 'Copied.',
      rubricCta:
        'TeacherHubPro drafts rubrics with AI, saves them and uses them when grading essays.',
    },
    home: {
      seeItWork: 'See it work',
      factTrial: '{days}-day free trial',
      factNoCard: 'No payment card needed',
      factLanguages: '7 languages',
      demoEyebrow: 'See it work',
      demoTitle: 'One sentence in. A whole week out.',
      demoIntro:
        'Pick a job below and watch TeacherHubPro do it. The AI drafts, and nothing reaches students or families until you say so.',
      demoLabel: 'Demo',
      sampleNote: 'Sample class for illustration.',
      replay: 'Play again',
      tabPrep: 'Plan my week',
      tabGrade: 'Grade a test',
      tabGame: 'Run a live game',
      tabFamily: 'Keep families informed',
      prepTitle: 'Prep Agent',
      prepText:
        'Type one sentence. You get a Monday-to-Friday plan, slides, worksheets, a Friday quiz and a parent email, ready for you to check.',
      prepRule: 'Everything stays a draft until you approve it.',
      prepPrompt: 'Fractions for my 4th grade class, week of November 23',
      prepMon: 'Mon',
      prepTue: 'Tue',
      prepWed: 'Wed',
      prepThu: 'Thu',
      prepFri: 'Fri',
      prepDay1: 'What is a fraction?',
      prepDay2: 'Fractions on a number line',
      prepDay3: 'Equivalent fractions',
      prepDay4: 'Comparing fractions',
      prepDay5: 'Review and quiz',
      prepSlides: '5 slide decks',
      prepWorksheets: '5 worksheets',
      prepQuiz: 'Friday quiz',
      prepEmail: 'Parent email',
      draft: 'Draft',
      approved: 'Approved',
      prepReview: 'Review each piece, change anything, then approve.',
      prepApprove: 'Approve the week',
      prepDone: 'Approved. Slides and worksheets are ready, and the parent email is sent.',
      gradeTitle: 'AI grading',
      gradeText:
        'Students answer from a private link. The AI suggests a score and says why, and you keep it or change it with one click.',
      gradeRule: 'Only grades you confirm reach the gradebook and report cards.',
      gradeQuestionLabel: 'Question 4 · Short answer',
      gradeQuestion: 'Why do we need a common denominator before adding 1/3 and 1/4?',
      gradeAnswerLabel: 'Student answer',
      gradeAnswer:
        'Because the pieces are different sizes, so you can’t just add them. You change both to twelfths so they match, then 4/12 + 3/12 = 7/12.',
      gradeSuggestion: 'AI suggestion',
      gradeReason1: 'Explains why the pieces must match',
      gradeReason2: 'Correct common denominator and sum',
      gradeReason3: 'Could name the term “equivalent fractions”',
      gradeKeep: 'Keep {score}',
      gradeChange: 'Change to {score}',
      gradeKept: 'Confirmed by you · now in the gradebook',
      gradeChanged: 'Changed to {score} by you · now in the gradebook',
      gameTitle: 'Live games',
      gameText:
        'Start a game, show the PIN, and the class joins from any phone, tablet or laptop. Scores update live.',
      gameRule: 'Students join with a PIN and their name. No accounts.',
      gameJoin: 'Join at teacherhubpro.com/play',
      gameTeam1: 'Team Owl',
      gameTeam2: 'Team Fox',
      gameTeam3: 'Team Bee',
      gameQuestion: 'Which is bigger?',
      gameEqual: 'They are equal',
      gameUnsure: 'Can’t tell',
      familyTitle: 'Family portal',
      familyText:
        'Each family gets a private, read-only link with confirmed grades and attendance.',
      familyRule: 'Grades you have not confirmed stay hidden.',
      familyPortal: 'Family portal · private link',
      familyQuiz: 'Fractions quiz',
      familyReading: 'Reading log, week 3',
      familyScience: 'Science project',
      familyTest: 'Unit test',
      familyHidden: 'Shown after the teacher confirms',
      familyAttendance: 'Attendance this term',
      prepRow1: 'Lesson plan, Monday to Friday',
      prepRow2: 'Slides and worksheets',
      prepRow3: 'Parent email',
      ready: 'Ready',
      waiting: 'Waiting for you',
      languagesEyebrow: 'Seven languages, fully translated',
      languagesWrites: 'The AI writes in the language you choose:',
      languagesPick: 'Choose a language',
      hello: 'Hello, class!',
      sampleTitle: 'Fractions worksheet',
      toolsEyebrow: 'Works with what you use',
      toolsTitle: 'Fits into your school day',
      toolsIntro: 'Send work to the tools your students already open.',
      toolsReady: 'Ready to use',
      pathStep1: 'AI drafts',
      pathText1: 'Grades, plans and parent emails start as drafts.',
      pathStep2: 'You review',
      pathText2: 'Keep it, change it or throw it away.',
      pathStep3: 'You approve',
      pathText3: 'Each approval is logged with who and when.',
      pathStep4: 'Families see it',
      pathText4: 'Only confirmed grades reach report cards and portals.',
      save: 'Save {percent}%',
      stickyText: 'Try every tool free for {days} days',
    },
    video: {
      title: 'See TeacherHubPro in about a minute',
      note: 'Captions are available in seven languages: choose CC in the player.',
      scriptTitle: 'Read the video script',
      p1: 'Meet TeacherHubPro, your AI teaching workspace, built to make everyday teaching easier.',
      p2: 'Planning next week? Just type one sentence. The Prep Agent drafts your lesson plans, slides, worksheets, a Friday quiz, and even a parent email.',
      p3: 'Every weekly plan is aligned to Common Core standards, organized by day, and fully editable. Your plan, your way.',
      p4: 'Turn any lesson into slides in seconds. Present full screen in class, print handouts, or send them straight to Google Classroom.',
      p5: 'Build online tests, or import a PDF. Students answer from a private link, and the AI suggests grades for you to confirm.',
      p6: 'Keep your gradebook, report cards, and attendance in one place, with a private portal that keeps families informed.',
      p7: 'Start each day with the Command Center: today’s classes, what’s left to grade, students who may need help, and upcoming lessons.',
      p8: 'And you’re always in control. The AI drafts, and you decide. Nothing reaches students or families until you approve it.',
      p9: 'Try TeacherHubPro free for seven days. No credit card needed. Visit teacherhubpro.com.',
    },
    feature: {
      lesson_planner: {
        title: 'Lesson planner',
        text: 'Weekly plans with Common Core standards, drafted by AI and edited by you.',
      },
      ai_assistant: {
        title: 'AI assistant',
        text: 'Worksheets, quizzes, summaries and activities in your language.',
      },
      presentations: {
        title: 'Presentations',
        text: 'Slides drafted by AI, presented full screen, printed, or sent to Google Classroom.',
      },
      gradebook: {
        title: 'Gradebook and report cards',
        text: 'Weighted categories, assignments and report card PDFs with your school’s logo.',
      },
      attendance: {
        title: 'Attendance',
        text: 'Daily attendance with tardies, excused days and reports.',
      },
      assignments: {
        title: 'Online tests and AI grading',
        text: 'Build questions or import a PDF test; students answer from a link; you confirm the AI’s suggested grades.',
      },
      games: {
        title: 'Games and live games',
        text: 'Educational games in many modes, and live classroom games students join with a PIN.',
      },
      learning: {
        title: 'Learning paths',
        text: 'AI-drafted lessons with checks, assigned to students through private links.',
      },
      families: {
        title: 'Family portal',
        text: 'Each family gets a private, read-only link to confirmed grades and attendance.',
      },
      command_center: {
        title: 'Command Center',
        text: 'Today’s classes, what to grade, students who may need help, and suggestions.',
      },
      prep_agent: {
        title: 'Prep Agent',
        text: 'One sentence becomes a week: plan, slides, worksheets, a Friday quiz and a parent email to review.',
      },
      schools: {
        title: 'For schools',
        text: 'School admins manage users and roles; bulk import teachers and students.',
      },
    },
    featuresPage: {
      metaTitle: 'Features | TeacherHubPro',
      metaDescription:
        'Lesson planning, AI tools, gradebook, attendance, presentations and a teacher-friendly workflow in one workspace.',
      title: 'Features',
      intro: 'What you can do with TeacherHubPro today.',
      learnMore: 'Learn more about {feature}',
      allFeatures: 'All features',
    },
    included: {
      title: 'Everything included',
      intro: 'Every feature TeacherHubPro has today, in one list.',
      prepAgent:
        'Prep Agent: one sentence becomes a week of lesson plans, slides, worksheets, a Friday quiz and a parent email, ready for you to review',
      planner:
        'AI lesson planner with Common Core and Puerto Rico standards, in a simple or classic plan layout',
      assistant:
        'AI assistant for worksheets, quizzes, summaries and activities, with English-learner (ESL) support',
      presentations:
        'AI slide presentations you present full screen, print, download as PowerPoint, or send to Google Classroom',
      tests:
        'Online tests students answer from a private link; write the questions or import a PDF test',
      aiGrading: 'AI grading of open answers, as suggestions the teacher confirms',
      gradebook: 'Weighted gradebook and report card PDFs with your school’s logo',
      attendance: 'Daily attendance with tardies, excused absences and reports',
      games: 'Educational games in many modes, and live classroom games students join with a PIN',
      learning:
        'Learning paths: AI-drafted lessons with checks, assigned through private student links',
      families:
        'Family portal: a private, read-only link to confirmed grades and attendance, plus weekly parent updates by email',
      commandCenter:
        'Command Center: today’s classes, what to grade, and students who may need help',
      subPacket: 'Substitute teacher packets',
      listen: 'Listen: plans and materials read aloud',
      google:
        'Google integration: Google sign-in, Google Classroom (import rosters, post assignments, Word documents and presentations), Google Forms quizzes, and files in your own Google Drive',
      canva:
        'Canva: open presentations and worksheets in your own Canva account as editable designs',
      microsoft:
        'Microsoft OneDrive: save presentations as PowerPoint and worksheets as Word files in your own OneDrive',
      teams:
        "Microsoft Teams, for schools that use Teams for classes: on request, import class lists from a Teams class and share assignments to it. Your school's IT administrator approves the connection once.",
      languages:
        'Seven languages: English, Spanish, French, Portuguese, German, Italian and Chinese; the AI writes in the language you choose',
      privacy:
        'No student or parent accounts: private links stored only as hashes, which you can revoke and which expire; built for FERPA and COPPA',
      aiDrafts:
        'AI suggests, the teacher decides: grades, insights and parent emails stay drafts until you approve them',
      schools:
        'For schools and districts: admin pages, roles, and bulk import of teachers and students',
      audiences: 'For classroom teachers, schools, tutors and homeschool families',
    },
    features: {
      'lesson-planning': {
        title: 'Lesson planning',
        description:
          'Weekly lesson plans with Common Core standards, drafted by AI and edited by you.',
        intro: 'Plan a week in minutes and keep every plan in one place.',
        p1Title: 'Weekly and Conversational English plans',
        p1Text:
          'Objectives, skills, standards and day-by-day activities, in the format teachers already use.',
        p2Title: 'AI drafts, you decide',
        p2Text:
          'Ask for a draft for your subject, grade and topic; nothing is saved until you edit and save it.',
        p3Title: 'Real Common Core codes',
        p3Text:
          'Standards come from the official Common Core list for the subject and grade; codes are checked, never invented.',
        p4Title: 'Templates, folders and printing',
        p4Text:
          'Save templates, organize plans in folders, duplicate a week, see a calendar, and print or save as PDF.',
      },
      gradebook: {
        title: 'Gradebook and report cards',
        description: 'Weighted categories, assignments, grades and report card PDFs.',
        intro: 'Grades that add up the way your school counts them.',
        p1Title: 'Weighted categories',
        p1Text: 'Set categories and weights per class, or start from the standard ones.',
        p2Title: 'Real points, real averages',
        p2Text: 'Each assignment keeps its own maximum, and averages use the category weights.',
        p3Title: 'Report cards',
        p3Text: 'Report card PDFs per semester, with your school’s logo and teacher comments.',
        p4Title: 'Only confirmed grades',
        p4Text:
          'AI-suggested grades stay drafts; report cards and families see only grades you confirmed.',
      },
      attendance: {
        title: 'Attendance',
        description: 'Daily attendance with present, absent, tardy and excused, and reports.',
        intro: 'Take attendance in seconds and see patterns over time.',
        p1Title: 'Fast daily sheet',
        p1Text: 'Everyone starts as present; mark the rest, with minutes late and notes.',
        p2Title: 'Submit and reopen',
        p2Text: 'A submitted day is locked until you reopen it.',
        p3Title: 'Reports',
        p3Text: 'Each student’s counts and attendance rate over the days you choose.',
        p4Title: 'Feeds the Command Center',
        p4Text: 'Absences and tardies count toward the at-risk list on your dashboard.',
      },
      'ai-tools': {
        title: 'AI tools',
        description:
          'Worksheets, quizzes, summaries, activities, slides, games and grading suggestions.',
        intro: 'AI that saves you drafting time and leaves every decision to you.',
        p1Title: 'AI assistant',
        p1Text:
          'Worksheets, quizzes, topic summaries, activities and lesson plans in the language you choose.',
        p2Title: 'PDF to online test',
        p2Text:
          'Upload a test as a PDF; the AI splits it into questions you review before students see them.',
        p3Title: 'Grading suggestions',
        p3Text:
          'The AI suggests scores and feedback for open answers; you confirm or change each one.',
        p4Title: 'Listen',
        p4Text: 'Have text read aloud for students who learn better by listening.',
      },
      presentations: {
        title: 'Presentations',
        description:
          'Slides drafted by AI, edited, presented, printed or sent to Google Classroom.',
        intro: 'Make a deck for tomorrow’s lesson in a few minutes.',
        p1Title: 'Drafted by AI or started blank',
        p1Text: 'Give a topic, subject and grade, or start from an empty deck.',
        p2Title: 'Layouts and themes',
        p2Text: 'Title, content, two-column and quote layouts, emoji, themes and transitions.',
        p3Title: 'Present and print',
        p3Text: 'Present full screen, or print one slide per page.',
        p4Title: 'Google Slides in Classroom',
        p4Text:
          'Send a presentation to a Google Classroom course as a Google Slides deck students can view.',
      },
      workflow: {
        title: 'Teacher-friendly workflow',
        description: 'Classes, rosters, a daily dashboard, Student 360 and the Prep Agent.',
        intro: 'Less clicking, more teaching.',
        p1Title: 'Classes and rosters',
        p1Text: 'Classes with schedules, and rosters from a CSV file or Google Classroom.',
        p2Title: 'Command Center',
        p2Text:
          'Today’s classes, what is left to grade, students who may need help, and upcoming lessons.',
        p3Title: 'Student 360',
        p3Text:
          'One student’s average, attendance, missing work, a timeline and your private notes.',
        p4Title: 'Prep Agent',
        p4Text:
          'Type one sentence about next week and review a full week of drafts before publishing.',
      },
    },
    ai: {
      metaTitle: 'AI features | TeacherHubPro',
      metaDescription:
        'What TeacherHubPro’s AI drafts, what it is sent, and why the teacher always decides.',
      title: 'AI that drafts, teachers who decide',
      intro:
        'Every AI feature in TeacherHubPro makes a draft. You review, edit and approve before anything reaches students or families.',
      listTitle: 'What the AI can draft',
      planner: 'Weekly lesson plans with Common Core codes',
      assistant: 'Worksheets, quizzes, summaries and activities',
      slides: 'Presentation slides',
      extractor: 'Online test questions from a PDF',
      grader: 'Suggested scores and feedback for open answers',
      games: 'Game content for every game mode',
      paths: 'Learning path lessons with checks',
      insight: 'A short insight on one student’s trends, from numbers only',
      prep: 'A week of plans, slides, worksheets, a quiz and a parent email',
      principlesTitle: 'How we use AI',
      principle1: 'AI output is always a draft until a teacher approves it.',
      principle2:
        'The AI is sent only the fields a task needs; student names are not sent when they are not needed.',
      principle3: 'Prompts, student work and personal data are not written to logs.',
      principle4: 'The AI writes in the language the teacher chooses.',
      governance: 'Read our AI governance page',
    },
    useCasesPage: {
      title: 'Use cases',
      intro: 'TeacherHubPro for the way you teach.',
    },
    useCases: {
      'classroom-teachers': {
        title: 'Classroom teachers',
        description: 'Plans, attendance, grades and families for classroom teachers.',
        intro: 'Get your planning and paperwork done, and spend your energy on teaching.',
        n1Title: 'Plan faster',
        n1Text: 'Weekly plans, slides and worksheets drafted by AI, ready for you to adjust.',
        n2Title: 'Grade with less effort',
        n2Text:
          'Online tests from a link, automatic scoring for closed questions, AI suggestions for open ones.',
        n3Title: 'Keep families informed',
        n3Text: 'Private family links show confirmed grades and attendance.',
      },
      homeschool: {
        title: 'Homeschool families',
        description: 'Plans, records, learning paths and progress for homeschool families.',
        intro: 'Structure for your homeschool, without the busywork.',
        n1Title: 'A plan for every week',
        n1Text: 'Weekly plans with Common Core standards for each subject and grade.',
        n2Title: 'Records you can show',
        n2Text: 'Attendance, grades and report cards kept in one place.',
        n3Title: 'Learning at their pace',
        n3Text: 'AI-drafted learning paths and games your children open from a private link.',
      },
      tutors: {
        title: 'Tutors',
        description: 'Materials, practice and progress for tutors.',
        intro: 'Prepare sessions quickly and show progress clearly.',
        n1Title: 'Materials on demand',
        n1Text: 'Worksheets, quizzes and slides for any topic and level.',
        n2Title: 'Practice between sessions',
        n2Text: 'Assign tests, games and learning paths through links; no student accounts needed.',
        n3Title: 'Progress for parents',
        n3Text: 'Share a read-only family link with confirmed results.',
      },
      schools: {
        title: 'Schools',
        description: 'One workspace for every teacher, with admin pages and bulk import.',
        intro: 'Give every teacher the same tools, and keep student data in one school.',
        n1Title: 'Admin pages',
        n1Text:
          'School admins see their users, change roles and hand classes from one teacher to another.',
        n2Title: 'Bulk import',
        n2Text: 'Import teachers and student rosters from spreadsheets.',
        n3Title: 'School plan',
        n3Text: 'Per-teacher pricing billed yearly, from 10 teachers.',
      },
    },
    pricingPage: {
      metaTitle: 'Pricing | TeacherHubPro',
      metaDescription:
        'Individual, School and District plans, with a free 7-day trial and no payment card needed.',
      title: 'Pricing',
      intro:
        'Every plan includes every feature. Start with a free {days}-day trial; no payment card needed.',
      minimum: 'From {count} teachers',
      start: 'Start free trial',
      contactSales: 'Contact us',
      faqTitle: 'Pricing questions',
      faq1Q: 'What happens when the trial ends?',
      faq1A:
        'You keep your data. To keep using the app, choose a plan on the Plans and billing page.',
      faq2Q: 'How do School and District plans work?',
      faq2A: 'You pay per teacher, billed yearly: School from 10 teachers, District from 100.',
      faq3Q: 'How do I pay?',
      faq3A: 'Payments are handled by Stripe. TeacherHubPro never sees or stores card numbers.',
    },
    integrationsPage: {
      metaTitle: 'Integrations | TeacherHubPro',
      metaDescription:
        'Google sign-in, Google Classroom, Forms, Drive and Slides, Canva, Microsoft OneDrive, Stripe and email.',
      title: 'Integrations',
      intro: 'The services TeacherHubPro works with today, through their official APIs.',
    },
    enterprisePage: {
      metaTitle: 'Schools and districts | TeacherHubPro',
      metaDescription:
        'TeacherHubPro for schools and districts: admin pages, bulk import and per-teacher plans.',
      title: 'For schools and districts',
      intro: 'Give every teacher the same workspace, with student data kept inside your school.',
      p1Title: 'Admin pages',
      p1Text:
        'See every user of your school, change roles, send password links and hand classes over.',
      p2Title: 'Bulk import',
      p2Text:
        'Teachers and student rosters from CSV files, checked row by row before anything is created.',
      p3Title: 'Privacy by design',
      p3Text:
        'School-scoped data, hashed student and family links, encrypted Google tokens, and AI that only drafts.',
      p4Title: 'Per-teacher plans',
      p4Text: 'School from 10 teachers and District from 100, billed yearly.',
      cta: 'Talk to us about your school',
    },
    contactPage: {
      metaTitle: 'Contact | TeacherHubPro',
      metaDescription:
        'Questions, a demo for your school, or help: write to the TeacherHubPro team.',
      title: 'Contact us',
      intro: 'Questions, a demo for your school, or help with your account: we read every message.',
      name: 'Your name',
      email: 'Email',
      organization: 'School or organization (optional)',
      role: 'I am a',
      phone: 'Phone (optional)',
      interest: 'I am interested in',
      message: 'Message',
      consent: 'We use these details only to answer you. We never sell them.',
      send: 'Send',
      sent: 'Thank you. We will get back to you soon.',
    },
    roles: {
      teacher: 'Teacher',
      homeschool: 'Homeschool parent',
      tutor: 'Tutor',
      school_admin: 'School administrator',
      principal: 'Principal',
      district: 'District leader',
      parent: 'Parent',
      other: 'Other',
    },
    interests: {
      features: 'Features',
      pricing: 'Pricing',
      demo: 'A demo',
      school: 'A plan for my school',
      enterprise: 'A district plan',
      support: 'Help with my account',
      other: 'Something else',
    },
    helpPage: {
      metaTitle: 'Help | TeacherHubPro',
      metaDescription: 'Get started with TeacherHubPro and find answers to common questions.',
      title: 'Help',
      intro: 'Start here, or write to us from the contact page.',
      startTitle: 'Getting started',
      step1: 'Sign up with your email or Google account.',
      step2: 'Create a class and import your roster from a CSV file or Google Classroom.',
      step3: 'Set up grade categories and take your first attendance.',
      step4: 'Ask the AI for a weekly plan, or the Prep Agent for a whole week.',
      faqTitle: 'Common questions',
      faq1Q: 'How do students get their work?',
      faq1A:
        'You make private links per student from an assignment; students open them without an account.',
      faq2Q: 'How do families see progress?',
      faq2A:
        'Send each family a private, read-only portal link; it shows only grades you confirmed.',
      faq3Q: 'I forgot my password.',
      faq3A: 'Use “Forgot password?” on the log-in page; we email you a one-time link.',
      faq4Q: 'How do I connect Google Classroom?',
      faq4A:
        'Open Connected tools, choose Connect Google Classroom, then pick your teacher account.',
    },
    chat: {
      open: 'Chat with Ed',
      close: 'Close chat',
      title: 'Ed, TeacherHubPro’s AI assistant',
      intro:
        'Hi! I’m Ed, an AI assistant. I can answer questions about TeacherHubPro’s features and prices.',
      rolePrompt: 'Which best describes you?',
      interestPrompt: 'What would you like to know about?',
      placeholder: 'Type your question',
      send: 'Send',
      you: 'You',
      ed: 'Ed',
      thinking: 'Ed is writing…',
      failed: 'Sorry, I could not answer that. Try again, or use the contact page.',
      limit: 'This chat has reached its limit. Please use the contact page to reach the team.',
      leadPrompt: 'Want the team to follow up? Leave your details.',
      leadOpen: 'Leave my details',
      leadSent: 'Thanks! The team will be in touch.',
      aiNote:
        'Answers come from an AI and can be wrong; prices on the Pricing page are the reference.',
    },
    leads: {
      title: 'Leads',
      intro: 'People who left their details in the website chat or the contact form.',
      score_high: 'High',
      score_medium: 'Medium',
      score_low: 'Low',
      source_chat: 'Chat',
      source_contact: 'Contact form',
      status_new: 'New',
      status_contacted: 'Contacted',
      status_closed: 'Closed',
      search: 'Search by name, email or organization',
      score: 'Priority',
      source: 'Source',
      status: 'Status',
      all: 'All',
      filter: 'Filter',
      empty: 'No leads yet.',
      received: 'Received',
      saveStatus: 'Save status',
      statusFor: 'Status for {name}',
    },
  },
  legal: {
    updated: 'Last updated: {date}',
    contact: 'Questions about this page? Write to us from the contact page.',
    privacy: {
      title: 'Privacy policy',
      description: 'What data TeacherHubPro keeps, why, and how it is protected.',
      s1Title: 'Who this covers',
      s1Text:
        'This policy covers teachers, school staff and homeschool parents who use TeacherHubPro, and the student and family information they enter. Students and families do not create accounts; they use private links a teacher gives them.',
      s2Title: 'What we keep',
      s2Text:
        'Account details (name, email, school, language), what teachers create (classes, plans, assignments, grades, attendance, notes), and what students submit through their links. Student records hold only what a feature needs: names, an optional student number, an optional parent email, optional accommodations and, optionally, the language the family reads. A school can also upload its own curriculum guides: school material, not student data. Their text is kept until the school removes them (an uploaded file is deleted once its text is read), and it is sent to the AI provider only with requests that use it.',
      s3Title: 'How we use it',
      s3Text:
        'Only to run the service for the school or teacher who entered it. We do not sell personal data or use student data for advertising.',
      s4Title: 'Who we share it with',
      s4Text:
        'Service providers that run the app: our hosting and database provider, Stripe for payments, an email provider for messages, Anthropic (Claude) for AI drafts, OpenAI for read-aloud audio, Google when a teacher connects Google Classroom, Canva when a teacher connects Canva (only the presentation or worksheet the teacher opens there, never student data), and Microsoft when a teacher connects Microsoft (only the files the teacher saves to OneDrive, never student data). Each receives only what its task needs.',
      s5Title: 'Where data is kept',
      s5Text:
        'All data, including uploaded files, is stored in one database in Virginia, USA, run by our hosting provider, Render.',
      s6Title: 'How it is protected',
      s6Text:
        'Passwords are stored as one-way hashes. Session, student, family and password links are random and stored only as hashes. Google Classroom, Canva and Microsoft tokens are encrypted. Every record belongs to one school and is reachable only by that school’s users. A teacher’s calendar link is also random and stored only as a hash: it shows only plan titles and assignment titles with their dates, never student information, and the teacher can replace it or turn it off in Settings.',
      s7Title: 'Keeping and deleting data',
      s7Text:
        'Data stays while the account is active. Uploaded PDFs are deleted once they are read. Website chats are deleted after 30 days. To ask for a copy or deletion of your data, write to privacy@teacherhubpro.com. A school’s admins and the account owner can also do this themselves in Settings: “Download all school data” gives one ZIP of spreadsheets, and “Delete all school data” erases everything after a 30-day hold that can be canceled. When a school’s contract ends, we return its data as files on request, then delete it from the service and confirm in writing.',
      s8Title: 'If something goes wrong',
      s8Text:
        'If a security breach affects your school’s data, we tell you within 72 hours of finding it: what happened, what data was involved and what we are doing about it.',
      s9Title: 'For schools and districts',
      s9Text:
        'Schools and districts can sign the Student Data Privacy Consortium’s National Data Privacy Agreement (NDPA) with us, the standard agreement many US districts already use. If your district has its own agreement, send it and we will review it. Write to privacy@teacherhubpro.com to start.',
      s10Title: 'Contact',
      s10Text: 'Privacy questions, agreements and data requests: privacy@teacherhubpro.com.',
    },
    terms: {
      title: 'Terms of use',
      description: 'The terms for using TeacherHubPro.',
      s1Title: 'The service',
      s1Text:
        'TeacherHubPro is a web app for teaching: planning, classes, attendance, grades, assignments, AI drafting tools and family portals.',
      s2Title: 'Your account',
      s2Text:
        'Accounts are for adults: teachers, school staff, tutors and parents. Students do not have accounts; they use the private links their teacher shares. Keep your password safe, use the app for teaching and learning, and follow the acceptable use rules. You are responsible for the content you create and the student information you enter, and for having the right to enter it.',
      s3Title: 'AI drafts',
      s3Text:
        'AI features make drafts that can contain mistakes. You review and approve them before use; grades and reports count only once you confirm them.',
      s4Title: 'Plans and payment',
      s4Text:
        'New accounts get a free 7-day trial. Paid plans renew until cancelled; prices are on the Pricing page. Payments are processed by Stripe.',
      s5Title: 'Your content',
      s5Text:
        'You keep the rights to what you create. You let us store and process it only to run the service for you.',
      s6Title: 'Changes',
      s6Text:
        'We may update these terms; we will show the date of the latest version on this page.',
    },
    cookies: {
      title: 'Cookies',
      description: 'The cookies TeacherHubPro uses.',
      s1Title: 'Only what the app needs',
      s1Text:
        'TeacherHubPro uses a few cookies to work. We use no advertising or tracking cookies.',
      s2Title: 'The cookies',
      s2Text:
        'thp_session keeps you signed in (30 days). thp_oauth_state protects Google sign-in and Classroom connection while they happen. thp_tz remembers your time zone so “today” is your today. thp_tour_seen remembers that you closed the welcome tour.',
      s3Title: 'The website chat',
      s3Text:
        'The website chat keeps its conversation key in your browser tab only, and it ends when you close the tab.',
    },
    accessibility: {
      title: 'Accessibility',
      description: 'How TeacherHubPro meets accessibility standards, and what is not done yet.',
      s1Title: 'Our standard',
      s1Text:
        'TeacherHubPro is built to meet WCAG 2.1 level AA, the standard US schools are asked to meet. Our accessibility report (VPAT), which goes through each requirement, is available on request.',
      s2Title: 'How we check',
      s2Text:
        'Every page a teacher, student or family can reach is tested automatically for WCAG 2.1 A and AA issues on every change, in English and Spanish. Other tests check that the main tasks work with a keyboard alone, with a visible focus ring, and that pages fit a phone screen.',
      s3Title: 'What helps',
      s3Text:
        'Labelled forms, headings and landmarks; strong text contrast on screen and dark-on-white printouts; less motion when your device asks for it; the whole interface in seven languages; and a Listen button that reads learning lessons and presentations aloud.',
      s4Title: 'Not done yet',
      s4Text:
        'Downloaded PDFs, such as report cards, are not yet tagged for screen readers; the same information is on the page in the app. Assignment questions do not have a Listen button yet. Pages run by others, such as Stripe checkout and Google sign-in, follow their own accessibility.',
      s5Title: 'Tell us',
      s5Text:
        'If something is hard to use, or you need the accessibility report, write to us from the contact page and tell us the page and what happened.',
    },
    acceptableUse: {
      title: 'Acceptable use',
      description: 'What TeacherHubPro may and may not be used for.',
      s1Title: 'Use it for teaching',
      s1Text: 'Use TeacherHubPro to plan, teach, assess and communicate with families.',
      s2Title: 'Do not',
      s2Text:
        'Do not enter student information you are not allowed to share, try to reach another school’s data, share private student or family links publicly, overload or attack the service, use the AI tools to make harmful, illegal or unrelated content, or use it as a student to do your own schoolwork.',
      s3Title: 'If rules are broken',
      s3Text: 'We may suspend access that puts students, schools or the service at risk.',
    },
    ferpa: {
      title: 'FERPA',
      description: 'How TeacherHubPro handles education records.',
      s1Title: 'Education records',
      s1Text:
        'Grades, attendance, assignments and notes that teachers enter are education records. We process them only to provide the service to the school or teacher, under their direction.',
      s2Title: 'Access',
      s2Text:
        'Records are reachable only by users of the school they belong to. Families see their own child’s confirmed grades and attendance through a private link.',
      s3Title: 'No other use',
      s3Text: 'We do not sell education records or use them for advertising.',
    },
    coppa: {
      title: 'Children’s privacy (COPPA)',
      description: 'How TeacherHubPro protects children’s information.',
      s1Title: 'No student accounts',
      s1Text:
        'Students do not sign up or give us personal information directly. Teachers, schools and parents enter the information a feature needs, and students use private links.',
      s2Title: 'Only what is needed',
      s2Text:
        'We collect only what a feature needs, send the AI only what a task needs, and never use children’s information for advertising.',
      s3Title: 'Parents',
      s3Text:
        'Parents can ask their child’s teacher or school to review or delete their child’s information, or write to us from the contact page.',
    },
    aiGovernance: {
      title: 'AI governance',
      description: 'The rules TeacherHubPro’s AI features follow.',
      s1Title: 'Drafts only',
      s1Text:
        'AI grades, student insights, plans, prep batches and parent emails are drafts until a teacher approves them. Report cards, the gradebook total and family portals show only teacher-confirmed grades.',
      s2Title: 'Least data',
      s2Text:
        'Each AI task is sent only the fields it needs. Student insights get numbers and assignment titles, not names. Prompts, student work and personal data are not written to logs.',
      s3Title: 'No invented facts',
      s3Text:
        'The AI is told not to invent grades, attendance, standards codes, prices or features, and its replies are checked: for example, standards codes must exist and the website chat may state only real prices.',
      s4Title: 'Honest about AI',
      s4Text: 'The website chat is an AI assistant and says so when asked.',
      s5Title: 'Providers',
      s5Text:
        'AI drafts are made with Anthropic’s Claude; read-aloud audio with OpenAI. Under their business terms, these companies do not use what we send them to train their models, and delete it within 30 days, unless they must keep it longer to look into misuse or by law.',
    },
    trust: {
      title: 'Trust center',
      description: 'How TeacherHubPro protects schools, teachers, students and families.',
      s1Title: 'Built for minors’ data',
      s1Text:
        'Students and families use private links instead of accounts. Links are random, stored only as hashes, can be revoked, and expire.',
      s2Title: 'School scoping',
      s2Text:
        'Every record belongs to one school, and every action checks the user’s school and role.',
      s3Title: 'Secrets and passwords',
      s3Text:
        'Passwords are hashed; Google tokens are encrypted; secrets are never written to logs; the code is scanned for leaked secrets on every change.',
      s4Title: 'AI with limits',
      s4Text:
        'AI only drafts, gets only what a task needs, and is checked against invented facts. See the AI governance page.',
      s5Title: 'Agreements',
      s5Text:
        'Need a student data privacy agreement or have a security question for your school? See the privacy policy, or write to privacy@teacherhubpro.com.',
    },
  },
} as const;
