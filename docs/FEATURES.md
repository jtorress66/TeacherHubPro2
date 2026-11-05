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
- **Decided for the rebuild:**
  - **A game holds one kind of content** (questions, true/false statements, fill-in sentences, term–definition pairs, ordered steps or groups) and each mode plays one kind: quiz and time attack play questions; flashcards, matching, memory, word search and crossword play pairs; true/false, fill in the blanks, sequence and drag and drop (sort items into groups) play the others. **"All modes"** is a pairs game the student plays in any mode that suits it, quiz and time attack included (each term with four definitions to choose from). A new mode is a new class registered in `GameModeRegistry`; every mode passes the shared game-mode contract.
  - **Students play from their personal link** (step 10), so every play is tied to a roster student; there is no public game link. The teacher can preview any game, and previews are never saved. A game is shared with one class, and its students see it on their link page.
  - **The server builds and scores every round.** A round comes from a seed: the browser gets the round without its answers, sends the student's answers back with the seed, and the mode's own rules score them. **Play again** is a new seed (a new shuffle of questions, options, grids and layouts), free; fresh items written by the AI are for the teacher only and need AI access.
  - **Leaderboard:** each student's best play in their class, by first name only (the student's own row is marked); the teacher sees full names. Ties go to the faster play.
  - **Game grades need the teacher.** "Count as a grade" (best, first or average attempt, for 1–1000 points, in one of the class's categories) adds an assignment to the gradebook; each student's grade is a draft until the teacher confirms the game's grades in one click, adjusting any. Confirming again updates them.
  - Content is typed one item per line (`question | option | *right option`, `term = definition`, `group: item, item`, …) or written by the AI from a topic, subject, grade and language, then reviewed before saving. The AI is sent nothing about the class or its students.
  - Memory shows both cards once turned, so its round says which cards belong together; the challenge is remembering where they are.
  - Evals: the game writer (6 cases, one per kind of content, in six languages) is scored on hand-written saved replies in `pnpm test`; real runs wait for go-live.
- **Kept from the old app:** the quality rules (placeholder text such as "TODO", "lorem ipsum" or "Option A" is rejected; the right answer must be among the options; enough items for the mode; a title such as "Quiz" or "Game" is rejected), grade-band wording for the AI, score with time taken, per-student attempts, best and last scores, the analytics summary (plays, students, average), and the bug fixes: a word search grid is built once per round, words are found in any case, its total is the number of words, and consecutive replays are shuffled differently.
- **Fixed from the old app:**
  - Scores were posted by the browser to a public endpoint with a typed `player_name`, and grades were matched to students by that name: plays now come only through a student's own link, and the server scores the answers itself.
  - Play-again regenerated the questions with the AI on every replay, with no subscription check: replays reshuffle for free; new AI items are a teacher action that needs AI access.
  - A game counted as a grade by creating grades on every score, unseen: grades are drafts until the teacher confirms them.
  - Quality rules lived partly in prompt text and partly in a separate validator, with endpoints that skipped it: one set of domain rules checks every game, whether typed or written by the AI.
- **Dropped (agreed in the step 11 plan):** the separate "smoke test" and "validate" endpoints (the domain checks and the game-mode contract replace them); sound effects (a later polish step).

## Step 12 — Play to Learn (live)

- Practice assignment: subject, grade, topic, standard, difficulty (easy, medium, hard), item count (default 10), allowed game types (default quiz, time attack, matching, flashcard), language (default `es`).
- Live session (like Kahoot): PIN to join, host selects a mode, starts, advances questions; students submit answers; complete, close. Real-time updates over WebSocket.
- Self-paced mode, teacher's session list, insights per assignment.
- Old files: `backend/routes/play_to_learn.py`, `frontend/src/pages/PlayToLearnLanding.js`, `PlayToLearnTeacher.js`, `PlayToLearnHost.js`, `PlayToLearnGame.js`.
- **Decided for the rebuild:**
  - **Live games reuse step 11 games.** The teacher runs any game of theirs with one of its classes, live or self-paced. Live play uses the question modes (quiz, and pairs games played as a quiz; true/false); self-paced plays any mode with the regular game player. AI drafts gain an optional Common Core standard (checked against the real codes) and a difficulty (easy, medium, hard).
  - **Joining:** the teacher's screen shows a 6-digit PIN. Students open `/play`, enter it and tap their first name from the class list (a last initial is added when two share a first name); a taken name is greyed out, and the teacher can remove a player, which frees the name. No typed nicknames and no accounts: every answer is tied to a roster student.
  - **Scoring is practice only, never a grade:** a right answer earns up to 1000 points, more the faster it comes (`1000 × (1 − t/T ÷ 2)`), plus 100 per answer in a row after the first, capped at +500. The leaderboard shows after each question, and each student sees their rank and streak.
  - **A realtime service** (`apps/realtime`, a third Render service) carries the game over WebSocket. Messages are handled one at a time per session, so answers that arrive together cannot miss each other. The answer is revealed when everyone has answered or the time is up.
  - **Insights** on each game's page: sessions, participants, average accuracy, the questions from hardest to easiest, and each student's accuracy.
- **Kept from the old app:** PIN and lobby; the host starts, advances and ends the game; answers over WebSocket; streaks; the self-paced mode; the teacher's session list and delete; insights per game with no grades.
- **Fixed from the old app:**
  - The WebSocket trusted `role=host` and a participant ID from the URL: host and player tickets are now HMAC-signed, expire after 4 hours, and every command is checked on the server.
  - The browser sent its own `time_taken_ms` and score: the server now times each question and scores every answer; a player never receives the answer before the reveal.
  - Typed nicknames: replaced by first names from the roster.
  - A PIN pointed at any session that wasn't complete: a PIN is now unique among open sessions only, and an open session closes by itself after 3 hours.
  - A student could hold two seats: a student has at most one active seat per session (enforced by the database).
- **Dropped (agreed in the step 12 plan):** the separate "practice assignment" entity (games cover it, now with a standard and a difficulty); live variants of the non-question modes (they are played self-paced).

## Step 13 — Adaptive learning and student progress

- Generate a learning path per student (async), student learning link, complete a lesson (from the teacher view or the student link), progress and dashboard per student.
- Old files: `backend/routes/adaptive_learning.py`, `frontend/src/pages/AdaptiveLearning.js`, `StudentLearning.js`, `StudentProgress.js`.
- **Decided for the rebuild:**
  - **A path is a short personal sequence** of 3 to 8 lessons for one student in one subject. Each lesson has an objective, a reading and 3 to 6 multiple-choice checks; the checks follow the games' quiz rules (real options, the answer among them, no placeholders).
  - **AI suggests, the teacher decides:** the AI drafts a path as a background job; the teacher reviews it, can edit every lesson and check, and assigns it. Only assigned paths reach the student. Assigning a new path archives the student's previous one in that subject; archived paths keep their progress.
  - **One student or the whole class:** a class batch queues one job per student, each at that student's own level.
  - **Students use their personal link** (step 10): a "Your learning" section lists their assigned paths with progress bars. No separate learning link.
  - **Completing a lesson means answering its check.** The server scores it and only then shows the right answers to what was missed. Retries are kept; each lesson counts once, by its best score. Practice only: nothing reaches the gradebook.
  - **Adaptive level (1 to 5, 3 is on grade level):** the next path starts from the latest path's level, one up when its lessons average 85% or more, one down under 60%. Objectives scored under 60% are sent back to the writer to review first; those at 85% or more as already mastered.
  - **The writer is sent** the subject, grade, language, level, lesson count, topic and those objectives: never a name or an ID.
  - **Reading aloud:** the teacher's review page uses Listen (step 9); the student's lesson page uses the device's own voice, which is free and keeps the text on the device.
  - **Progress:** the class page shows each student's lessons done, average check score, level per subject and last activity; a student page shows each subject and every path's lessons with best score and attempts.
  - Evals: the path writer (6 cases: en, es, fr, pt, de, zh; levels 1 to 4; with and without objectives to review) is scored on hand-written saved replies in `pnpm test`; real runs wait for go-live.
- **Kept from the old app:** a path per student and subject with a title, description and level; lessons with an objective, duration, reading and check questions; generation as a background job the page polls; the student's lesson list with X of Y done and a progress bar; reading aloud; printing a path (one lesson per page, here with an answer key); the teacher dashboard (lessons, completed, % complete); the AI access check.
- **Fixed from the old app:**
  - The student's full name was sent to the AI: only the subject, grade, language, level and objectives are sent.
  - The right answers were sent to the browser and the check was never scored: the student's view has no answers, and the server scores every check.
  - Teacher routes completed or read any student's lessons by ID, and the dashboard had no school check: every use case is scoped to the school and to classes the teacher manages.
  - The level rose on the teacher route but not the student route (and only counted lessons): one domain rule sets it, from check scores.
  - A new path overwrote the old one, and "completed" counted lessons of overwritten paths, so it could pass 100%: paths are kept, and progress counts real attempts on real lessons.
  - A separate learning token per subject, unhashed and valid 30 days: the student's existing link, stored as a hash and revocable.
- **Dropped (agreed with the user in step 13):** the fixed subject list (math, language, science, reading), replaced by the app's subjects; the old separate student progress page (folded into the learning pages; Student 360 is step 15); the teacher's button that marked a lesson complete without the check (completion means answering the check, so progress always reflects real answers).

## Step 14 — Parent and homeschool portals, email

- Portal token per student; parent portal shows grades and attendance. Homeschool portal token and reports. Email a portal link (Resend). Trial reminder emails.
- Old files: `backend/routes/portal.py`, `server.py` (portal, `/portal/email`, portal email ~2874, trial reminders ~3850–3930), `frontend/src/pages/ParentPortal.js`, `HomeschoolPortal.js`.
- Fix: an old email linked to the Emergent preview site. Every link uses the configured site URL.
- **Decided for the rebuild:**
  - **One family portal** per student (the old parent and homeschool portals together): a private, read-only link showing confirmed grades with the class's weighted average, upcoming work for the next 7 days, attendance (rate, counts and the last 10 days), learning paths and games, all tied to the roster student ID, with a printable progress report. Homeschool families use the same page.
  - **Links** work like student links: random, stored only as a hash, until the end of the class's semester (180 days without one), revocable. The teacher emails a link (to the roster's parent email or another address, in the family's language) or makes a new one to copy; either way the family's earlier link stops working, and the full link is shown once.
  - **Only confirmed grades:** the gradebook holds teacher entries only (AI drafts and game plays become grades only when the teacher confirms them), and pending work shows as "not graded yet", never with a score.
  - **Email** goes through a `Mailer` port: Resend's HTTP API in production at go-live, and until then a local stand-in that keeps mail in the database, readable at `/{locale}/dev/mail` outside production. While production has no real mailer, the app offers no email (copying a link still works) and sends no trial reminders, so nothing is lost or recorded as sent.
  - **Trial reminders** go to the account owner 3 days before the trial ends and on its last day, each once, in their language, from the worker's minute housekeeping; paid plans get none.
  - Email texts live with the translations (`packages/i18n`), in English and Spanish; other languages fall back to English.
- **Kept from the old app:** a portal link per student, emailed to the parent; a read-only portal with the student's grades, averages, recent and upcoming work and attendance summary; the homeschool view of learning progress and games; revoking a link; a bilingual email with the link and "read-only, contact the teacher"; trial reminder emails with the paid-plan check and no duplicates.
- **Fixed from the old app:**
  - Portal tokens were stored in plain text: they are random, stored as a hash, revocable and expiring.
  - The portal showed raw grade records: only teacher-entered grades, and pending work shows no score.
  - The average assumed points as stored: the gradebook's weighted category average, the same as report cards.
  - Homeschool game scores were found by matching a typed first name: game plays by roster student ID.
  - The attendance rate counted only "present": tardy counts as present, as in the attendance report.
  - Generating a token never checked who owned the student: only the class's teacher, in their school.
  - Reminders were deduplicated only within 24 hours, and the cron trigger accepted a default key: one record per trial and reminder, and the worker runs them itself with no public trigger.
- **Dropped (agreed in the step 14 plan):** the separate homeschool token and portal (one family portal); student photos (not collected).

## After step 14 — Word documents and Google

Added at the teacher's request, between steps 14 and 15 (not in the old app).

- **AI assistant card "Send a Word document to Google Classroom":** the teacher picks a Google Classroom course, gives a title, optional instructions and due date, and uploads their own Word document (`.docx`; a renamed PDF is refused). It goes to the teacher's Google Drive (`drive.file`) unchanged and is attached to a new Classroom assignment with `STUDENT_COPY`: each student gets their own copy, which opens in Google Docs to type in, and grading happens in Classroom. (Converting it to a Google Doc first was tried; Classroom refused the converted Doc with NOT_FOUND on the live site.) No AI is involved and nothing is kept in TeacherHubPro.
- **The assignment's "Send to Google" section** (Questions page): **Google Classroom** gets a link to the online test (the step 10 share), so answers are tied to roster students and grades reach the gradebook; **Google Forms (one-way):** "Make a Google Forms quiz" builds a self-scoring quiz in the teacher's Drive from the assignment's questions. Multiple choice, true/false (labels in the teacher's language) and fill-in-the-blank keep their answer keys and points (whole points, at least 1); short answers and essays are left for the teacher to score in Forms; matching becomes a grid (Forms cannot score grids), with the right-hand side sorted so the pairs do not show. **Forms scores are not brought back** into the gradebook: Forms identifies students by email, not roster ID. The last quiz made is kept on the assignment; making another replaces it.
- **Google access:** the Classroom connection also asks for `drive.file` (only files the app creates). Connecting always shows Google's account chooser. With no active course as a teacher, the card says so and offers to connect another account. Google's refusals are named (an API turned off in the Cloud project, a reconnect needed) and logged as one line (step, code, Google's reason; no tokens or files).
- **Dropped at the teacher's request (2026-11-05):** every PDF option on the card — posting a PDF as it is, an AI copy of a PDF as a Google Doc, a PDF read into a Google Forms quiz without a class, and a PDF read into a new assignment. Google's PDF-to-Docs conversion scrambles test layouts and the AI copy could not match the original closely enough, so teachers post their own Word documents instead. The step 10 PDF import on a class assignment's Questions page stays. Migration 0015 drops the `google_quizzes` table that the no-class quizzes used.

## Step 15 — Command Center and Student 360

- Command Center (`/dashboard`): today's classes for the current weekday, sorted by period and time, with attendance done or to take; stats (classes today, attendance done/total, to grade, at-risk); assignments to grade with progress and overdue highlight; recommendations; quick actions; lessons for the next 7 days.
- At-risk rules (old `server.py` ~3280). Score points: average < 60% → failing (+3); < 70% → low (+2); missing ≥ 3 → +2, missing 1–2 → +1; absences ≥ 20% of sessions → +3, otherwise ≥ 3 absences → +1; tardies ≥ 5 → +1. Flag when score ≥ 2; show the top 10, highest first.
- Fix: the old average assumed every assignment was out of 100 points. Use each assignment's real maximum.
- Student 360 (`/students/:id`): grade average, attendance rate, missing count, a timeline newest first (grades, absences, tardies, excused, due dates, notes), private teacher notes, an on-demand AI insight that is cached.
- Old files: `server.py` (`/command-center` ~3200–3450, Student 360 ~1530–1620), `frontend/src/pages/CommandCenter.js`, `Student360.js`.
- **Decided for the rebuild:**
  - The Command Center **is the home page** (`/app`); the plan badge and getting-started checklist stay on top. "Today" is the teacher's time zone; only the teacher's own active classes count.
  - At-risk attendance counts the **last 30 days** of submitted sessions; the average is the gradebook's weighted average on each assignment's real maximum (a missing grade counts as 0, as in the gradebook).
  - "Missing" is a grade marked missing, or past-due work with no grade (excused never counts); work not yet due is never missing. Student 360 uses the same rule.
  - To grade: per assignment, student submissions not yet confirmed plus students with no grade on past-due work; overdue first, then by due date, top 10.
  - Recommendations are four rules (take attendance, reach out when a risk score is 4 or more, overdue grading, classes without lessons in the next 7 days), shown in the teacher's language.
  - Student 360 lives at `/app/classes/:classId/students/:studentId` (the edit form moved to `…/edit`; roster names link there). Grades on the timeline are dated by their assignment's due date (grades carry no date of their own).
  - **Private notes** are visible to their author only (a school admin sees their own, not the teacher's).
  - **AI insight:** on demand, a worker job; 3–5 bullets in the teacher's language, kept per teacher and student, labelled "AI draft, check before acting", never shown to families. It is sent **numbers and assignment titles only** (no name, accommodations or notes); replies that state a percentage not in the data are refused and retried. Replay evals in `evals/replays/insight.json`.
- **Fixed from the old app:**
  - Every grade was assumed to be out of 100 points in the at-risk average: the real maximum and the category weights are used.
  - "Missing" counted assignments not yet due, and any assignment without a score.
  - To grade counted only `status == graded`, so late and excused grades looked pending, and AI submissions were added on top: waiting submissions and past-due ungraded students are counted once.
  - The insight sent the student's full name, accommodations and the teacher's notes to the AI, as a 60-second synchronous call with raw errors: anonymised numbers only, as a job with a validated reply and safe error codes.
  - "Today" was UTC.


## Step 16 — Prep Agent

- One prompt, for example "Prep next week for Unit 3 History (Civil War)", runs 4 steps: research and plan (standards and last week's lessons, daily plans) → materials (slides and worksheets per lesson) → Friday quiz → calendar events and a parent email summary.
- Progress tracker, side-by-side preview, edits, options (quiz, presentations, worksheets), editable parent email, in-app notification when ready, **Approve & Publish**.
- Old files: `backend/routes/prep_agent.py`, `frontend/src/pages/PrepAgent.js`.
- **Decided for the rebuild:**
  - A batch is for one class the teacher manages: a prompt, the week's Monday, 1–5 lessons, the subject and grade (suggested from the class), the drafts' language, and options (slides, worksheets, quiz, parent email). A quiz needs a grade category of that class.
  - Each item is drafted by its own worker job in order (the plan, then each day's slides and worksheet, then the quiz), so no job nears the job time limit; progress shows the 4 steps and a count. A stalled job can be resumed; a failed plan stops the batch and can be tried again; a failed slide deck or worksheet is skipped.
  - The plan reuses the lesson planner (one weekly plan; days after the requested number stay blank), with last week's plan for the class as context. Slides reuse the presentation writer and worksheets the AI assistant, each on that day's theme. The quiz is a new agent (10 questions: multiple choice, true/false, fill in the blank, short answer, each with its answer); replay evals in `evals/replays/quiz.json`.
  - **Calendar:** no separate calendar. The published plan shows on the Plans calendar and the quiz's Friday due date in the Command Center.
  - **Review:** the teacher ticks the drafts to keep, previews each one beside the list and edits the parent email (subject and text); everything else is edited after publishing in its usual editor.
  - **Ready notice:** a count badge on the Prep Agent menu link and a card on the Command Center; no email to the teacher.
  - **Approve & Publish:** saves the weekly plan, the slide decks, the worksheets (in the AI assistant's history) and the quiz as an assignment due Friday, and emails each distinct parent address on the roster separately (refused emails are counted). Only once per batch.
  - Batches are private to the teacher who started them.
- **Fixed from the old app:**
  - The batch ran inside the web server (lost on a restart): worker jobs stored in Postgres.
  - Any teacher in the school could prep any class: only classes the teacher manages.
  - The subject was guessed from keywords and the standards came from a short hard-coded list: the class's subject and grade, and the Common Core catalog through the lesson planner (codes are checked, never invented).
  - Five one-day plans: one weekly plan.
  - The quiz was unchecked JSON: validated gradebook questions, saved as an assignment.
  - The parent email was only queued and never sent: it is sent, one email per family.
  - Raw error messages reached the teacher, and edits overwrote the drafts without checks: safe error codes; only the ticks and the email change before publishing.

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
