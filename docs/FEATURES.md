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
- Old files: `server.py` (classes, students, semesters), `frontend/src/pages/Classes.js`, `components/OnboardingBanner.js`, `WelcomeTour.js`, `OnboardingVideo.js`.

## Step 6 — Attendance

- Session per class and date with a status per student: present, absent, tardy, excused. Submit a session.
- Attendance rate = (present + tardy) / total.
- Reports per class: rates per student and per period.
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
- Old files: `server.py` (gradebook, report cards ~4800–4950), `frontend/src/pages/Gradebook.js`, `GradebookReports.js`, `ReportCards.js`.

## Step 8 — AI platform and lesson planner

- All AI work runs as background jobs (POST returns a job ID at once; the client polls). The old app hit 504 timeouts and lost jobs when they lived in memory across workers, so jobs must be stored in Postgres, polling must be idempotent, jobs stuck for more than 5 minutes fail, and users can only read their own jobs.
- Lesson plans: weekly plans and **Conversational English** plans (with a title), standards framework (Common Core for Math, ELA, Science, Social Studies, K–12), additional instructions, calendar view, duplicate, print and PDF. Printing must render Markdown tables and clean fill-in-the-blank lines (an old bug printed `\_\_` and raw `|---|`).
- Folders for plans: create, rename, colour, delete (plans move to Unfiled), filter by All / Unfiled / folder.
- Templates, including starter and weekly templates.
- Old files: `backend/routes/ai.py`, `utils/constants.py` (system prompts, standards), `server.py` (plans, folders, templates), `frontend/src/pages/LessonPlanner.js`, `PlannerList.js`, `Templates.js`, `components/PlanPrintView.js`, `ConversationalEnglishPlanView.js`.

## Step 9 — AI assistant, presentations, voice

- AI assistant: content types and generations history, with print and PDF.
- Presentation creator: generate, edit, list, delete.
- Text-to-speech (`/tts/generate`): OpenAI TTS with our own key.
- Substitute packet per class (schedule, roster, plans).
- Old files: `routes/ai.py`, `server.py` (TTS ~4960, sub packet ~1165), `frontend/src/pages/AIAssistant.js`, `PresentationCreator.js`, `SubstitutePacket.js`.

## Step 10 — Assignments and AI grading

- Question types: multiple choice, true/false, fill in the blank, short answer, matching (left items with a dropdown each), essay. Per-question instructions. Every question has a `question_id`.
- File uploads on assignments; students see all attachments, PDFs included.
- **PDF → online test:** extract text, then the AI splits it into individual questions (one per fill-in sentence, true/false statement or multiple-choice item), with word banks and section instructions in `instructions`. Async with retries. The teacher reviews and edits before saving.
- Student assignment page from a link; the student submits answers.
- AI grading per submission; the teacher reviews and **confirms** before the grade counts (new rule). Grades flow into the gradebook, grade report and report card.
- Google Classroom: share an assignment (only when it has questions or attachments); import courses and rosters; create coursework. Scopes: `classroom.courses.readonly`, `classroom.coursework.students`, `classroom.rosters.readonly`, email, profile.
- Fix: the old app matched submissions to students by typed name (`names_match`, with Spanish particles and middle initials) and stored them in two places (`grades` and `ai_submissions`). Tie each submission to a roster student ID and keep one grade record.
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
