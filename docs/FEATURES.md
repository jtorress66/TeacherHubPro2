# TeacherHubPro — Feature inventory (from the legacy app)

Every feature of the Emergent-built app, grouped by build step: the behaviour to keep, known bugs to fix rather than copy, and the old files to read. The old repository is `github.com/jtorress66/TeacherhubPro`; paths below are relative to it. Read the old code to learn behaviour only (see `CLAUDE.md`, "Legacy app").

Legacy stack, for reference: FastAPI + MongoDB backend (`backend/server.py` is about 6,200 lines, plus `backend/routes/`), React (CRA) + shadcn/ui + Tailwind frontend, Claude Sonnet through Emergent's LLM key, OpenAI text-to-speech, Stripe, Resend, jsPDF in the browser and pdfplumber on the server. Product notes and the change history are in `memory/PRD.md`.

## Users and access

| Who | How they get in | Can |
| --- | --- | --- |
| Teacher | Email + password, or Google sign-in | Everything for their own classes. A new teacher gets their own school ("My School"). |
| School admin (`admin`) | Same | Manage the school's users and roles |
| Super admin (`super_admin`) | Same; first one created on `/setup-admin` | All schools and users, password resets, bulk imports |
| Student | Links only (assignment, game, learning path, Play to Learn PIN) | Take assignments, play games, do lessons |
| Parent / homeschool parent | Portal link only | Read their child's grades, attendance and reports |

Seven interface languages: English, Spanish, French, Portuguese, German, Italian and Chinese. English is the default; a `?lang=` link overrides the user's saved choice, which overrides the default (old file: `frontend/src/contexts/LanguageContext.js`). English and Spanish are fully translated; the other five fall back to English until translated.

---

## Step 4 — Auth, schools, roles, billing

- Email/password sign-up and login; Google sign-in (the old app went through Emergent's auth service: replace it with our own Google OAuth and match users by email).
- On first login, create a school for the teacher if they have none. Onboarding status: `not_started` → settings completed.
- Profile: name, language, picture.
- Plans (old `server.py` ~line 90): **Individual $9.99/month**, **Annual $79/year**, **School $6/teacher/month** and **District $4/teacher/month**, both billed yearly per teacher (quantity). **7-day free trial.** Stripe Checkout, success page, cancel, webhook. Trial reminder emails come in step 14.
- Old files: `backend/server.py` (auth ~600–1000, subscription ~3500–3750), `backend/routes/auth.py`, `backend/utils/auth.py`, `frontend/src/pages/Auth.js`, `Pricing.js`, `SubscriptionSuccess.js`, `Settings.js`, `contexts/AuthContext.js`, `contexts/SchoolContext.js`.
- Fix: `JWT_SECRET` had a public default. It must be required.

## Step 5 — Classes, students, semesters

- Class: name, subject, grade, section, school year, **period (1–12), start and end time (HH:MM), days of week (default Mon–Fri)**. Create, edit (no blank names), delete.
- Students per class: add, edit, delete, bulk add. Semesters: create, edit, set the active one.
- Onboarding banner, welcome tour, onboarding videos (`frontend/public/*.mp4` can be reused).
- **Decided for the rebuild:**
  - "Delete class" **archives** the class: it is hidden from lists but kept with its roster and records, and can be restored.
  - **CSV import** (new: the old app only took JSON) is all-or-nothing. A file with any bad row imports nothing and lists every bad row with its line number. Headers can be in English or Spanish; comma or semicolon separated.
  - Student `email` and `notes` are not stored (data minimisation); private notes return in step 15.
  - The onboarding checklist has "School information" and "First class"; step 8 adds "First plan". The welcome tour covers only built features. The old videos are not reused (they show the old screens).
- **Fixed from the old app:**
  - Semester edits and deletes had no school check; every read and write is now scoped to the caller's school.
  - Bulk add accepted blank names; every row now uses the same rules as adding one student.
  - Deleting a class orphaned its students; it now archives.
- Old files: `server.py` (classes, students, semesters), `frontend/src/pages/Classes.js`, `components/OnboardingBanner.js`, `WelcomeTour.js`, `OnboardingVideo.js`.

## Step 6 — Attendance

- Session per class and date with a status per student: present, absent, tardy, excused. Submit a session.
- Attendance rate = (present + tardy) / total.
- Reports per class: rates per student and per period.
- Kept from the old app: everyone starts as present, a "Mark all present" button, a note per student and minutes late, Save and Submit. Reports default to the last 30 days and colour rates (90% and up green, 80% and up amber, otherwise red). Print button.
- **Decided for the rebuild:**
  - Reports count **submitted days only**. Each student's total is the submitted days they were on that day's roster, so a student who joins mid-term is not counted absent for earlier days.
  - A note is at most 200 characters. Minutes late (1–240) can only be set on a tardy.
  - A submitted day refuses changes; the teacher can **reopen** it to correct it.
  - The report range has presets (last 30 days, the active semester) and a custom range. "Today" is the teacher's day, from the browser's time zone.
  - Archived classes keep their attendance, read-only.
- **Fixed from the old app:**
  - Saving attendance had no teacher or school check; every attendance use case now checks that the caller manages the class.
  - Saving again could overwrite a submitted session; now it is refused until the day is reopened.
  - Reports counted unsubmitted sessions, gave every student the same total and counted an unmarked student as absent.
- Old files: `server.py` (`/attendance`), `frontend/src/pages/Attendance.js`, `AttendanceReports.js`.

## Step 7 — Gradebook and report cards

- Grade categories per class with `weight_percent`. Manual assignments: title, category, points, due date, questions, files.
- Bulk grade entry. Gradebook grid per class. Gradebook report per class.
- **Percentages use the sum of the questions' points** as the maximum.
- GPA on a 4.0 scale (old `server.py` ~4870): ≥ 90% → 4.0; 80–90 → 3.0 + (p − 80)/10; 70–80 → 2.0 + (p − 70)/10; 60–70 → 1.0 + (p − 60)/10; below 60 → p/60.
- Report cards: generated per student with the school's logo, grades and attendance.
- Manual grades take precedence over AI grades for the same assignment.
- **Overall grade (decided for the rebuild):** each category's average is its points earned ÷ points possible; the overall grade weights those averages by `weight_percent`, rescaled over the categories that have counted grades. If every such weight is 0, the categories count equally. (The old app stored weights but ignored them.)
- **Which grades count:** `graded` and `late` count with their score; `missing` counts as 0; `excused` and `pending` are left out. (The old report card counted every row, so excused work scored 0.)
- **Recorded examples** (reproduced by `packages/domain/src/gradebook/grade-calculations.test.ts`):

  | # | Setup | Overall | GPA |
  | --- | --- | --- | --- |
  | 1 | Tests 50%: 45/50 (90%). Homework 30%: 7/10 and 9/10 (80%). Projects 20%: no grades yet. | (50×90 + 30×80) ÷ 80 = **86.25%** | 3.625 |
  | 2 | Homework 100%: 10/10 graded, one excused, one pending, one missing (all out of 10). | 10 ÷ 20 = **50%** | 0.83 |
  | 3 | Tests 100%: a 100-point assignment with three 10-point questions, scored 24. | 24 ÷ 30 = **80%** | 3.0 |
- Kept from the old app: the total of the category weights is shown (with a warning when it is not 100), a category that still has assignments cannot be deleted, standard categories (Homework 25, Quiz 25, Test 30, Project 20), grade entry for a whole assignment at once, a gradebook grid, a report with the class average, GPA and A–F distribution, and report cards with the school logo, grades by category, overall grade, GPA, attendance, teacher comments and signature lines, for one student or the whole class. Letters: A from 90%, B from 80, C from 70, D from 60, otherwise F.
- **Decided for the rebuild:**
  - The report card is a **real PDF made on the server** (`ReportCardRenderer` port, `pdf-lib` adapter), one page per student. It uses the standard PDF font, which prints English, Spanish and the other Latin-alphabet languages; letters it cannot print lose their accents (ễ → e) and other scripts print as "?" until a full Unicode font is added.
  - The school **logo is uploaded** in Settings (PNG or JPEG, at most 1 MB, checked by its bytes) and stored through the `FileStore` port (Postgres for now). The server never fetches a logo from a URL.
  - **Questions and files on assignments wait for step 10.** Step 7 assignments have a title, category, points and due date; the maths already uses question points when questions exist.
  - **Report card comments are saved** per student and class (so per semester), up to 1,000 characters.
  - The standard categories are a button, not created silently, and are named in the teacher's language.
  - Deleting an assignment deletes its grades. An archived class keeps its gradebook read-only.
  - Report card attendance counts submitted days within the class's semester, or every submitted day when the class has none.
- **Fixed from the old app:**
  - The report card endpoint had no teacher or school check; every gradebook use case now checks that the caller manages the class, and tests prove another school's class is unreachable.
  - Weights were stored but ignored, and excused work scored 0 (see "Overall grade" and "Which grades count" above).
  - AI grades were matched to students by typed name or email; only grade rows tied to a roster student ID count (confirmed AI grades join them in step 10).
  - The report page used a different GPA and letter scale from the report card; there is now one scale everywhere.
  - Report card attendance counted unsubmitted days and ignored the chosen semester.
- Old files: `server.py` (gradebook, report cards ~4800–4950), `frontend/src/pages/Gradebook.js`, `GradebookReports.js`, `ReportCards.js`.

## Step 8 — AI platform and lesson planner

- All AI work runs as background jobs (POST returns a job ID at once; the client polls). The old app hit 504 timeouts and lost jobs when they lived in memory across workers, so jobs must be stored in Postgres, polling must be idempotent, jobs stuck for more than 5 minutes fail, and users can only read their own jobs.
- Lesson plans: weekly plans and **Conversational English** plans (with a title), standards framework (Common Core for Math, ELA, Science, Social Studies, K–12), additional instructions, calendar view, duplicate, print and PDF. Printing must render Markdown tables and clean fill-in-the-blank lines (an old bug printed `\_\_` and raw `|---|`).
- Folders for plans: create, rename, colour, delete (plans move to Unfiled), filter by All / Unfiled / folder.
- Templates, including starter and weekly templates.
- Kept from the old app: weekly plans (class, unit, story, teacher, objective, up to four skills, standards, expectations, and Monday–Friday days with a theme, Depth of Knowledge levels, E/C/A marks, an activity checklist with notes, a materials checklist and notes; subject integration), an optional **second week**, Conversational English plans (title required, lesson dates, topic, objectives, materials, hook, learning goal, closure, test/quiz date, notes), the AI draft form (subject, grade, topic, difficulty, class period, instructions) with the five-day progression (introduction, guided practice, independent practice, mastery, assessment), folders (create, rename, colour, delete to Unfiled, filter All / Unfiled / folder, plan counts), duplicate to another week (both weeks move), five starter templates in English and Spanish, a template of the week rotating by ISO week, saving a plan as a template, a month calendar, and AI access only with an active trial or plan.
- **Decided for the rebuild:**
  - **Evals use real Claude** (`pnpm eval`, ten fixed cases in all seven languages, thresholds in `evals/thresholds.json`); CI runs them on pull requests once the `ANTHROPIC_API_KEY` secret is set. E2E and local runs use a scripted stand-in for Claude in the worker. The model is `claude-sonnet-5-5` (changed from Opus to cut API costs) unless `ANTHROPIC_MODEL` says otherwise, with Claude's server-side fallback on refusals. Replies are streamed, so long drafts are never cut off by a timeout and paid for twice.
  - **Common Core codes come from the official list**, imported once (`pnpm standards:import`) from the Common Standards Project's data for the CCSS Mathematics and ELA & Literacy documents (CC BY 3.0 US) and checked in: Math and ELA K–12, plus the 6–12 literacy codes (RH, RST, WHST) for social studies and science. Science and social studies before grade 6 have no Common Core codes. The model is shown only the codes for the subject and grade and may cite only those; any other code is dropped, and saved plans accept only listed codes.
  - **Printing is a print page** (the browser's *Save as PDF* makes the PDF), not a server PDF.
  - **The optional second week is kept.**
  - The AI draft is structured JSON mapped onto the plan's fields and opened in the editor; nothing is saved until the teacher saves it. Drafts start new plans (week 1); week 2 and edits are the teacher's.
  - Activities, materials, Depth of Knowledge levels, day types, subject integrations and folder colours are fixed lists; English is added to subject integration.
- **Fixed from the old app:**
  - Jobs lived in memory and hit 504s: they are rows in Postgres, claimed by `apps/worker` with `FOR UPDATE SKIP LOCKED`; the web app only enqueues and reads.
  - Polling deleted jobs two minutes after the first read: polling is now a pure read. A job not finished 5 minutes after it was created reads as `timed_out`, and the worker's sweep stores it.
  - Another user's job answered 403 (showing it exists): it is now not found. Only safe failure codes are stored, never raw errors or prompts.
  - The AI draft was pasted as raw text into day 1's notes, split by regex on day names: it now fills the plan's real fields.
  - The AI invented standards codes and the PR Core option was ignored in the prompt: only official Common Core codes are kept, and PR Core is dropped (not in this inventory).
  - Printing showed `\_\_` and raw `|---|`: a tested Markdown renderer prints headings, lists, bold, tables and blank lines, without raw HTML.
  - AI output followed only Spanish or English: it follows the teacher's language in all seven.
- **Dropped (agreed in the step 8 plan):** per-day AI suggestions and the generic AI tools (quiz, worksheet, summary, activities) move to step 9's assistant; the .ics calendar export; school-wide shared templates.
- Old files: `backend/routes/ai.py`, `utils/constants.py` (system prompts, standards), `server.py` (plans, folders, templates), `frontend/src/pages/LessonPlanner.js`, `PlannerList.js`, `Templates.js`, `components/PlanPrintView.js`, `ConversationalEnglishPlanView.js`.

## Step 9 — AI assistant, presentations, voice

- AI assistant: content types and generations history, with print and PDF.
- Presentation creator: generate, edit, list, delete.
- Text-to-speech (`/tts/generate`): OpenAI TTS with our own key.
- Substitute packet per class (schedule, roster, plans).
- Kept from the old app: the AI assistant's five content types (lesson plan, quiz with a number of questions, topic summary, class activities, worksheet) from subject, grade, topic, difficulty, class period and instructions, with copy and print; the generations history (list, open, delete); presentations (generate from topic, subject, grade, slide count and theme; edit, add, duplicate, reorder and delete slides; layouts title, content, image left/right, two columns and quote; eight themes; transitions; list, rename, delete; full-screen present mode with arrow keys and Escape); the substitute packet per class (emergency extensions, class information, this week's plan, roster with accommodations, a five-column seating chart in roster order, daily routines, emergency procedures and notes, saved per class, print page).
- **Decided for the rebuild:**
  - **Read aloud** (Listen) on assistant content and on each slide, in the editor and present mode, for signed-in teachers with AI access. OpenAI text-to-speech with our own `OPENAI_API_KEY` (`gpt-4o-mini-tts`, voice `OPENAI_TTS_VOICE`, default `nova`); E2E and local runs use a silent stand-in. Audio is made by a worker job and cached per school, so the same text is paid for once.
  - **No chat tab**: content types and history only.
  - **Slide pictures are emoji**; uploaded images come with step 10's file storage. No stock image search or external image URLs, so the `full-image` layout is dropped.
  - **Present mode and a print page** (one slide per page; the browser's *Save as PDF* makes the PDF). No .pptx or downloaded .html.
  - Everything the assistant makes is kept in the teacher's history until they delete it. Generations and presentations are private to their teacher (a school admin sees neither); the substitute packet is for the class's teacher or a school admin.
  - A slide draft is saved only when the teacher keeps it.
  - The substitute packet's roster can hide accommodations; the teacher chooses.
  - Evals: `pnpm eval` also runs eight assistant cases (every type and language) and four presentation cases against real Claude, with thresholds in `evals/thresholds.json`.
  - **Real-Claude evals only on request** (they cost money): every push scores hand-written saved replies (`evals/replays`) with the same scorecards and thresholds, in the unit tests; `pnpm eval` or CI's Run workflow scores real Claude.
- **Fixed from the old app:**
  - `/tts/generate` had no login check, so anyone could spend the key: speech needs a signed-in teacher with AI access, and audio is cached in file storage per school (not base64 in the browser) and served only within the school.
  - Assistant and slide calls held HTTP requests open for up to 90 seconds: they are worker jobs the page polls.
  - The assistant could invent standards codes: it is shown only the official codes for the subject and grade, and any other `CCSS.` code is removed from what it writes.
  - A bad slide reply fell back to a fake one-slide deck: the reply is checked, retried once with the reason, and otherwise the job fails with a safe message.
  - AI errors showed raw messages: only safe codes are stored.
  - AI output followed only Spanish or English: it follows the language the teacher chooses (all seven).
- **Dropped (agreed in the step 9 plan):** the chat tab; AI "customize template" (it pasted raw text into days; the step 8 planner covers it); stock image search, image URLs and the `full-image` layout; the downloaded `.html` presentation; the onboarding-video narration.
- Old files: `routes/ai.py`, `server.py` (TTS ~4960, sub packet ~1165), `frontend/src/pages/AIAssistant.js`, `PresentationCreator.js`, `SubstitutePacket.js`.

## Step 10 — Assignments and AI grading

- Question types: multiple choice, true/false, fill in the blank, short answer, matching (left items with a dropdown each), essay. Per-question instructions. Every question has a `question_id`.
- File uploads on assignments; students see all attachments, PDFs included.
- **PDF → online test:** extract text, then the AI splits it into individual questions (one per fill-in sentence, true/false statement or multiple-choice item), with word banks and section instructions in `instructions`. Async with retries. The teacher reviews and edits before saving.
- Student assignment page from a link; the student submits answers.
- AI grading per submission; the teacher reviews and **confirms** before the grade counts (new rule). Grades flow into the gradebook, grade report and report card.
- Google Classroom: share an assignment (only when it has questions or attachments); import courses and rosters; create coursework. Scopes: `classroom.courses.readonly`, `classroom.coursework.students`, `classroom.rosters.readonly`, email, profile.
- Fix: the old app matched submissions to students by typed name (`names_match`, with Spanish particles and middle initials) and stored them in two places (`grades` and `ai_submissions`). Tie each submission to a roster student ID and keep one grade record.
- **Decided for the rebuild:**
  - **One personal link per student per class** (random token stored only as a hash, revocable, expires the day after the class's semester ends or after 180 days). It lists that student's assignments; every submission carries their roster student ID. Links are shown once when made (copy or print), and can be revoked or replaced.
  - **Objective questions are scored by code on hand-in, at no cost:** multiple choice, true/false, matching (credit per correct pair) and fill-in-the-blank (ignoring case, extra spaces and ending punctuation). The AI only suggests scores and feedback for short answers and essays, when the teacher asks; every grade is a draft until the teacher confirms it (optionally adjusting the score) or grades by hand. One submission per student per assignment; a hand-in after the due date is accepted and marked late. Questions can no longer change once a student has handed in.
  - **PDF → online test reads text PDFs only** (a scan gets a clear "no text" message; OCR can come later). The PDF is kept only while the job reads it. The AI writes answers it cannot read from the test as its best guess, and the editor asks the teacher to check every question and answer before saving.
  - **Google Classroom is built against the official REST and OAuth endpoints** (like Google sign-in), with only the Classroom scopes it needs and the refresh token encrypted at rest (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`). A local stand-in is used in development and tests; connecting a real Google project is a go-live task. Sharing posts the title, instructions and due date with a link to the app, never a student's personal link; roster import adds names not already in the class.
  - Grade-level leniency for open answers comes from the old app's table (very lenient and spelling-tolerant in K–2, strict in 9–12), using the class's grade.
  - Evals: the question extractor (4 cases) and the grader (6 cases) are scored on hand-written saved replies in `pnpm test`; real runs wait for go-live.
- **Fixed from the old app:**
  - Submissions were matched to students by typed name and email (`names_match`) through one public link per assignment, and grades lived in two places: each submission now comes only through the student's own link, tied to their roster ID, and the teacher's decision writes the one `Grade` the gradebook and report cards read.
  - The "auto-approve" grading mode let AI scores count unseen: removed.
  - Grading ran as a fire-and-forget task with 90-second calls and raw error messages: it is a worker job; a failure is noted on the submission, which the teacher can still grade by hand.
  - The student's name was sent to the AI, and replies were parsed from raw text: the grader gets only the open questions, their model answers or rubrics and the answers; its reply is validated (each score within the question's points) and retried once with the reason.
  - The public endpoint logged every token on a miss and exposed raw errors: tokens are hashed and never logged; an unknown, revoked or expired link simply says it does not work.
  - The PDF parser split replies by regex and pasted raw text: the extractor returns validated questions, one per blank, statement or item, with section headers, word banks and passages in each question's instructions.
- **Dropped (agreed in the step 10 plan):** AI "generate assignment" from a topic (the step 9 assistant's quiz covers it); the grading statistics page (step 15's Command Center); scanned PDFs (OCR later).
- Old files: `backend/routes/ai_grading.py`, `routes/google_classroom.py`, `server.py` (assignments, uploads), `frontend/src/pages/AIGrading.js`, `StudentAssignment.js`, `components/AssignmentFiles.jsx`, `utils/generateTestPDF.js`.

## Step 11 — Educational games

- Modes: quiz, true/false, fill in the blanks, flashcards, matching, memory, sequence, time attack, word search, crossword, drag and drop, and "all modes".
- Generate with AI, validate (`utils/game_validator.py`, and `memory/GAME_QUALITY_OVERHAUL.md` for the quality rules), regenerate questions, save, play from a link, scores, leaderboard, per-student progress and stats, grade settings, analytics summary.
- Old files: `backend/routes/games.py`, `utils/game_validator.py`, `frontend/src/pages/GamesCreator.js`, `PlayGame.js`, and the word-search and play-again bug tests in `backend/tests/`.

## Step 12 — Play to Learn (live)

- Practice assignment: subject, grade, topic, standard, difficulty (easy, medium, hard), item count (default 10), allowed game types (default quiz, time attack, matching, flashcard), language (default `es`).
- Live session (like Kahoot): PIN to join, host selects a mode, starts, advances questions; students submit answers; complete, close. Real-time updates over WebSocket.
- Self-paced mode, teacher's session list, insights per assignment.
- Old files: `backend/routes/play_to_learn.py`, `frontend/src/pages/PlayToLearnLanding.js`, `PlayToLearnTeacher.js`, `PlayToLearnHost.js`, `PlayToLearnGame.js`.

## Step 13 — Adaptive learning and student progress

- Generate a learning path per student (async), student learning link, complete a lesson (from the teacher view or the student link), progress and dashboard per student.
- Old files: `backend/routes/adaptive_learning.py`, `frontend/src/pages/AdaptiveLearning.js`, `StudentLearning.js`, `StudentProgress.js`.

## Step 14 — Parent and homeschool portals, email

- Portal token per student; parent portal shows grades and attendance. Homeschool portal token and reports. Email a portal link (Resend). Trial reminder emails.
- Old files: `backend/routes/portal.py`, `server.py` (portal, `/portal/email`, portal email ~2874, trial reminders ~3850–3930), `frontend/src/pages/ParentPortal.js`, `HomeschoolPortal.js`.
- Fix: an old email linked to the Emergent preview site. Every link uses the configured site URL.

## Step 15 — Command Center and Student 360

- Command Center (`/dashboard`): today's classes for the current weekday, sorted by period and time, with attendance done or to take; stats (classes today, attendance done/total, to grade, at-risk); assignments to grade with progress and overdue highlight; recommendations; quick actions; lessons for the next 7 days.
- At-risk rules (old `server.py` ~3280). Score points: average < 60% → failing (+3); < 70% → low (+2); missing ≥ 3 → +2, missing 1–2 → +1; absences ≥ 20% of sessions → +3, otherwise ≥ 3 absences → +1; tardies ≥ 5 → +1. Flag when score ≥ 2; show the top 10, highest first.
- Fix: the old average assumed every assignment was out of 100 points. Use each assignment's real maximum.
- Student 360 (`/students/:id`): grade average, attendance rate, missing count, a timeline newest first (grades, absences, tardies, excused, due dates, notes), private teacher notes, an on-demand AI insight that is cached.
- Old files: `server.py` (`/command-center` ~3200–3450, Student 360 ~1530–1620), `frontend/src/pages/CommandCenter.js`, `Student360.js`.

## Step 16 — Prep Agent

- One prompt, for example "Prep next week for Unit 3 History (Civil War)", runs 4 steps: research and plan (standards and last week's lessons, daily plans) → materials (slides and worksheets per lesson) → Friday quiz → calendar events and a parent email summary.
- Progress tracker, side-by-side preview, edits, options (quiz, presentations, worksheets), editable parent email, in-app notification when ready, **Approve & Publish**.
- Old files: `backend/routes/prep_agent.py`, `frontend/src/pages/PrepAgent.js`.

## Step 17 — Admin and super admin

- School admin: list users and change roles. First super admin setup page.
- Super admin: overview, schools (create, edit, delete, classes), users (create, edit, delete, reset password, bulk), bulk import of teachers and students.
- Old files: `server.py` (`/admin` and `/setup` ~4060–4200, `/super-admin` ~4200–4700), `frontend/src/pages/AdminPanel.js`, `SetupAdmin.js`.

## Step 18 — Marketing site and chatbot

- Pages: landing, features overview and 6 feature pages (lesson planning, gradebook, attendance, AI tools, presentations, workflow), 4 use cases (classroom teachers, homeschool, tutors, schools), AI features, homeschool, integrations, pricing, contact, help, enterprise overview.
- Legal and trust: privacy, terms, cookies, accessibility, trust center, DPA, FERPA, COPPA, GDPR, SLA, security whitepaper, AI governance, incident response, breach policy, business continuity, vendor management, acceptable use, SOC 2. Review the claims in these pages with the user before publishing; do not state certifications the company doesn't hold.
- Lead chatbot on marketing pages: role → interest → free chat → lead form. Lead score: high (district, admin, enterprise), medium (teacher with email), low (other). Email on high-priority leads. Leads dashboard with stats, search and filter.
- `sitemap.xml`, `robots.txt`, canonical URLs.
- Images: the old app loaded its logo and feature images from Emergent's servers. Use the copies saved into `apps/web/public/images/`.
- Old files: `frontend/src/pages/Landing.js`, `pages/features/`, `pages/use-cases/`, `components/marketing/`, the legal pages, `routes/chatbot.py`, `components/ChatbotWidget.jsx`, `pages/LeadsDashboard.js`.

## Step 19 — Data migration

- Source: a `mongodump` (or JSON export) of the production database and a copy of the uploaded files. Collections: users, user_sessions, schools, classes, students, semesters, lesson_plans, plan_folders, ai_templates, attendance_sessions, attendance_records, grade_categories, assignments, grades, ai_assignments, ai_submissions, grading_jobs, generation_jobs, ai_generations, ai_chat_messages, presentations, educational_games, game_scores, game_progress, game_regenerations, practice_assignments, practice_sessions, practice_results, adaptive_learning_paths, adaptive_learning_progress, student_learning_tokens, portal_tokens, homeschool_portal_tokens, student_notes, student_insights, sub_packets, subscriptions, trial_reminders, leads, chatbot_sessions.
- Skip transient data: sessions, jobs, chat sessions.
- Merge `grades` and `ai_submissions` into one grade record per student and assignment; resolve name-matched submissions to roster IDs and report the ones that can't be resolved.
- Old shared links (assignment, game, portal and learning tokens) keep working: store their hashes.
- Old passwords: accept the old hashes (passlib/bcrypt) and rehash on first login.
- Idempotent; a dry run prints counts per collection and a list of skipped records.

## Not carried over

- Emergent editor scripts, the visual-edits and health-check plugins, the badge-hiding code, Emergent auth, the `emergentintegrations` library and the one-off video generation scripts.
- The old repo's committed `cookies.txt`, test credentials, `test_reports/` and `backend/uploads/` test files.
