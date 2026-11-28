// The product tour on /demo: one entry per screen of the app. Every claim must be true of the app
// today, and the screenshot beside it shows it. Keys follow apps/web/src/server/demo-tour.ts.

export const demoEn = {
  demo: {
    metaTitle: 'TeacherHubPro demo: see every feature, step by step',
    metaDescription:
      'A guided tour of TeacherHubPro with real screens: lesson plans, attendance, grading with AI, games, live games, parent portals and more.',
    title: 'See TeacherHubPro, step by step',
    intro:
      'A guided tour of the whole app in {steps} steps, with real screens. Every student you see is made up.',
    contents: 'Chapters',
    chapterNumber: 'Chapter {n}',
    enlarge: 'Open the full-size screenshot: {title}',
    madeUp:
      'All names, classes and grades in these screenshots are made up. The AI drafts were written by the app’s AI and are shown as it wrote them.',
    chapters: {
      start: {
        title: 'Getting started',
        intro: 'Sign up in a minute and start with a ready-made sample class.',
      },
      classes: {
        title: 'Classes, rosters and attendance',
        intro: 'Bring in your students from a spreadsheet and take attendance in seconds.',
      },
      planning: {
        title: 'Lesson planning',
        intro: 'Weekly plans aligned with Common Core and Puerto Rico standards, ready to print.',
      },
      assistant: {
        title: 'AI assistant',
        intro:
          'Worksheets, quizzes and rubrics drafted for your grade and topic. You edit and decide.',
      },
      presentations: {
        title: 'Presentations',
        intro:
          'Slides drafted by AI, ready to present or open in Google Slides, Canva or OneDrive.',
      },
      prep: {
        title: 'Prep Agent',
        intro: 'One sentence becomes a whole week, and you review everything before it goes out.',
      },
      assignments: {
        title: 'Assignments and AI grading',
        intro:
          'Turn a PDF into an online assignment, share it with a link, and confirm AI-suggested grades.',
      },
      gradebook: {
        title: 'Gradebook and report cards',
        intro: 'Weighted categories, semesters and report cards, from the grades you confirmed.',
      },
      games: {
        title: 'Educational games',
        intro: 'Eleven game modes, with an explanation for every answer and standards tracking.',
      },
      live: {
        title: 'Live classroom games',
        intro: 'Play together on the big screen while students answer on their phones.',
      },
      learning: {
        title: 'Adaptive learning and student insights',
        intro: 'Personal learning paths and early signs of who may need help.',
      },
      families: {
        title: 'Parent portal',
        intro: 'Families see grades and attendance through a private link, no account needed.',
      },
      substitutes: {
        title: 'Substitute packets',
        intro: 'Everything a substitute needs, printed in one click.',
      },
      connections: {
        title: 'Connected tools',
        intro: 'Works with Google, Microsoft, Canva and your school’s course system.',
      },
      schools: {
        title: 'For schools and districts',
        intro: 'Usage, controls, a record of AI decisions and your data, all in one place.',
      },
    },
    steps: {
      signup: {
        title: 'Create your account',
        text: 'Sign up with your email or your Google account. Your free trial starts right away, with no card needed.',
        alt: 'The TeacherHubPro sign-up page with name, email and password fields.',
      },
      commandCenter: {
        title: 'Your Command Center',
        text: 'Each morning you see today’s classes, work waiting to be graded and students who may need help, all on one screen.',
        alt: 'The Command Center with today’s classes, work to grade and a student who may need help.',
      },
      sampleClass: {
        title: 'Try it on a sample class',
        text: 'One click adds a sample class with made-up students, grades and attendance, so you can try everything before adding your own. Remove it whenever you like.',
        alt: 'The sample class page with six made-up students.',
      },
      rosterImport: {
        title: 'Import your roster',
        text: 'Upload a spreadsheet with first and last names. Student numbers, parent emails, accommodations and the family’s language are optional columns.',
        alt: 'A class roster after importing students from a spreadsheet.',
      },
      accommodations: {
        title: 'Keep accommodations in one place',
        text: 'Note each student’s accommodations once. They show up where they matter, such as the substitute packet, and stay private to you and your school.',
        alt: 'A student’s edit form with an accommodations field filled in.',
      },
      attendance: {
        title: 'Take attendance in seconds',
        text: 'Mark present, absent, late or excused for each student, add minutes late, and save the day.',
        alt: 'The attendance sheet with a status for each student.',
      },
      attendanceReport: {
        title: 'See attendance at a glance',
        text: 'The attendance report shows each student’s rate and every absence and late arrival for the dates you choose.',
        alt: 'The attendance report with each student’s attendance rate.',
      },
      planner: {
        title: 'Plan your week with standards',
        text: 'Write your weekly plan day by day and pick standards from the official Common Core and Puerto Rico lists. The app never invents a standard code.',
        alt: 'The weekly lesson planner with the Puerto Rico standards picker open.',
      },
      planPrint: {
        title: 'Print in your school’s format',
        text: 'Print plans in the classic format with your school’s header, or in a simple one-page format.',
        alt: 'A weekly lesson plan ready to print in the classic format.',
      },
      curriculum: {
        title: 'Add your curriculum guides',
        text: 'Upload or paste your school’s pacing guides. The AI follows them when it drafts plans, so drafts match what your school teaches.',
        alt: 'The curriculum guides page with a pacing guide ready to use.',
      },
      templates: {
        title: 'Start from a template',
        text: 'Begin a plan from a ready-made unit or from one of your own, then change anything you like.',
        alt: 'The templates page with ready-made units.',
      },
      assistantForm: {
        title: 'Ask the AI assistant',
        text: 'Choose a worksheet, quiz or lesson plan, then the subject, grade, topic and language. Tick ESL support for material at English learners’ level, following WIDA and Puerto Rico standards.',
        alt: 'The AI assistant form with type, topic, grade and ESL support.',
      },
      assistantResult: {
        title: 'Review the draft',
        text: 'The draft is ready in seconds. Copy it, print it, have it read aloud, open it in Canva or save it to OneDrive.',
        alt: 'A worksheet drafted by the AI assistant.',
      },
      rubric: {
        title: 'Build rubrics',
        text: 'Start a rubric from scratch or have the AI draft one, then edit every criterion and level. Use it to grade written answers.',
        alt: 'A rubric with criteria and levels, ready to edit.',
      },
      presentation: {
        title: 'Draft a presentation',
        text: 'Give a topic and the number of slides, choose a theme, and edit each slide before you present.',
        alt: 'A presentation drafted by AI, open in the slide editor.',
      },
      presentationExport: {
        title: 'Present it anywhere',
        text: 'Present from the browser, download PowerPoint, send it to Google Classroom and Slides, open it in Canva, or save it to OneDrive.',
        alt: 'A presentation’s options to send it to Google Classroom, Canva and OneDrive.',
      },
      prepStart: {
        title: 'One sentence, a whole week',
        text: 'Type what you are teaching this week. The Prep Agent drafts the plan, slides and worksheets for each day, a Friday quiz and a note for families.',
        alt: 'The Prep Agent form with one sentence describing the week.',
      },
      prepReview: {
        title: 'You review before anything goes out',
        text: 'Read each piece, keep or drop it, and edit the email to families. Nothing is published or sent until you say so.',
        alt: 'The Prep Agent review with the week’s plan, worksheets, quiz and family email.',
      },
      pdfImport: {
        title: 'Turn a PDF into an online assignment',
        text: 'Upload a worksheet or test as a PDF. The AI reads its questions into an editor where you check each one before saving.',
        alt: 'Questions imported from a PDF, ready to check and save.',
      },
      studentLinks: {
        title: 'Share with student links',
        text: 'Each student gets a private link: no accounts or passwords to manage. You can replace or turn off a link at any time.',
        alt: 'The student links page with a link for each student.',
      },
      studentAnswer: {
        title: 'Students answer on any device',
        text: 'Students open their link on a phone, tablet or computer, answer, and hand in. Questions can be read aloud.',
        alt: 'A student answering an assignment on a phone.',
      },
      aiGrading: {
        title: 'The AI suggests, you decide',
        text: 'Choice questions score themselves. For written answers the AI suggests a score and feedback, and nothing counts until you confirm or change it.',
        alt: 'A student’s answer with an AI-suggested score waiting for the teacher to confirm.',
      },
      gradebook: {
        title: 'A gradebook that adds up',
        text: 'Weighted categories, each student’s overall grade, and only the grades you confirmed.',
        alt: 'The gradebook with categories and each student’s overall grade.',
      },
      reportCards: {
        title: 'Report cards in minutes',
        text: 'Add a comment for each student and download report cards as PDFs, one by one or for the whole class.',
        alt: 'Report cards with grades by category and a teacher’s comment.',
      },
      gameBuilder: {
        title: 'Build a game in minutes',
        text: 'Write your own questions or have the AI draft them, then pick from eleven modes such as quiz, time attack, matching, memory and crossword.',
        alt: 'The game builder with question cards.',
      },
      gameReview: {
        title: 'Students learn why',
        text: 'After a round, students see the questions they missed with the right answer and a short explanation of why.',
        alt: 'A student’s review after a game, with the right answers and explanations.',
      },
      aiExplanations: {
        title: 'Explanations written for you',
        text: 'One click asks the AI to write a short “why” for every card that has none. You read and edit them before saving.',
        alt: 'AI-written explanations ready for the teacher to review.',
      },
      coverage: {
        title: 'See which standards you have covered',
        text: 'The coverage report shows how the class did on each standard you tagged, with one click to reteach what needs more work.',
        alt: 'The standards coverage report for a class.',
      },
      liveLobby: {
        title: 'Start a live game',
        text: 'Put the game on the big screen. Students join with a 6-digit PIN and tap their name from your roster.',
        alt: 'The live game lobby with the PIN and the students who joined.',
      },
      livePlayer: {
        title: 'Students play on their phones',
        text: 'Each student answers on their own device, against the clock, with points for speed and streaks.',
        alt: 'A student answering a live game question on a phone.',
      },
      liveReveal: {
        title: 'Reveal, explain, keep going',
        text: 'After each question the big screen shows the right answer, how the class answered and why, then the leaderboard.',
        alt: 'The big screen showing the right answer, the class’s answers and the explanation.',
      },
      learningPath: {
        title: 'Personal learning paths',
        text: 'Draft a short series of lessons for one student on the topic they need. You edit it, then assign it to their link.',
        alt: 'A learning path drafted for one student, open in the editor.',
      },
      studentLesson: {
        title: 'Lessons at the student’s own pace',
        text: 'The student reads each lesson, answers a quick check, and sees their score. You see their progress.',
        alt: 'A student working through a lesson on a phone.',
      },
      insights: {
        title: 'Know who may need help',
        text: 'Each student’s page brings together grades, attendance and notes. An AI summary suggests next steps for you to consider.',
        alt: 'A student’s page with grades, attendance and an AI summary.',
      },
      parentPortal: {
        title: 'Keep families in the loop',
        text: 'Families open a private link to see confirmed grades and attendance. Weekly notes from the Prep Agent can go to each family in their own language.',
        alt: 'The parent portal on a phone with grades and attendance.',
      },
      subPacket: {
        title: 'Be ready for a substitute',
        text: 'The substitute packet gathers your schedule, roster, plans, routines and contacts, ready to print.',
        alt: 'A substitute packet with schedule, roster and routines.',
      },
      integrations: {
        title: 'Connect your tools',
        text: 'Connect Google Classroom, Google Drive, Microsoft OneDrive and Teams, Canva and your calendar. You choose what is shared, one tool at a time.',
        alt: 'The Connected tools page with Google, Microsoft and Canva.',
      },
      schoolSystems: {
        title: 'Your school’s course system',
        text: 'Schools can open TeacherHubPro inside Canvas, Schoology, Moodle and D2L Brightspace and send confirmed grades back, through the LTI 1.3 standard. Available on request.',
        alt: 'The school systems section of Connected tools.',
      },
      schoolOverview: {
        title: 'The school overview',
        text: 'School leaders see how each teacher uses the app and can turn AI features and student flags on or off for the school.',
        alt: 'The school overview with usage by teacher and school-wide switches.',
      },
      schoolUsers: {
        title: 'Manage your school’s users',
        text: 'Give teachers and administrators the right role, and move a class to another teacher when someone leaves.',
        alt: 'The school users page with roles.',
      },
      approvals: {
        title: 'A record of every AI decision',
        text: 'AI work reaches students and families only after a teacher approves it. The approvals record shows who approved what and when, without student names or grades.',
        alt: 'The approvals record listing what teachers approved.',
      },
      dataExport: {
        title: 'Your data stays yours',
        text: 'Download all of your school’s data at any time, or delete the school and its data yourself.',
        alt: 'The settings page with the school data download and deletion.',
      },
      languages: {
        title: 'Seven languages',
        text: 'Use the app in English, Spanish, French, Portuguese, German, Italian or Chinese. The AI writes in the language you choose.',
        alt: 'The settings page with the language picker.',
      },
    },
  },
};
