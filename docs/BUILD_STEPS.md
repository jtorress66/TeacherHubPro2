# TeacherHubPro — Build Steps

Place this file at `docs/BUILD_STEPS.md`. Work on one step at a time. Tick a step only when its gate passes and the Definition of Done in `CLAUDE.md` is met. For each step, read its section in `docs/FEATURES.md` first.

**Current step:** 1

| # | Step | Scope | Gate (must pass before next step) | Done |
| --- | --- | --- | --- | --- |
| 1 | Foundation | pnpm monorepo, TypeScript strict, Vitest, Playwright, ESLint, GitHub Actions CI (incl. gitleaks and the no-Emergent check), package skeletons, `packages/i18n` with seven languages (`en` and `es` complete; `fr`, `pt`, `de`, `it`, `zh` falling back to English) | CI green on a sample unit test and a sample E2E test rendered in both languages | [ ] |
| 2 | Domain and ports | Entities (School, User, Class, Student, Semester, LessonPlan, Assignment, Question, Submission, Grade, AttendanceSession, Game, Subscription), state machines (submission: submitted → ai_graded → confirmed), all port interfaces, fakes | 100% unit coverage on state machines and grade/attendance calculations; ports have fakes in `packages/testing` | [ ] |
| 3 | Persistence | Postgres schema + migrations, repository adapters | Repository contract suites pass against a real test DB (Testcontainers) | [ ] |
| 4 | Auth, schools, roles, billing | Email/password and our own Google sign-in, school per teacher, roles (teacher, school admin, super admin), Stripe plans and 7-day trial, plan limits | E2E: sign up (email and Google stubbed) → school created → buy a plan (Stripe test mode) | [ ] |
| 5 | Classes, students, semesters | Classes with schedule (period, times, days), rosters, CSV bulk import, semesters, onboarding checklist | E2E: create a class with a schedule → import 25 students from CSV → edit one | [ ] |
| 6 | Attendance | Sessions per class and date, statuses (present, absent, tardy, excused), reports | E2E: take attendance → report shows correct rates | [ ] |
| 7 | Gradebook and report cards | Categories with weights, manual assignments and grades, GPA, gradebook report, report card PDF with school logo | Calculations match the recorded examples in `docs/FEATURES.md`; E2E: grade → report card PDF | [ ] |
| 8 | AI platform and lesson planner | `LlmClient` (Claude), job queue in the worker, standards (Common Core), weekly and Conversational English plans, templates, folders, duplicate, print/PDF | Evals for the planner meet thresholds; E2E: generate a plan as a job → edit → print | [ ] |
| 9 | AI assistant, presentations, voice | AI assistant content types, presentation creator, text-to-speech, substitute packet | Evals meet thresholds; E2E: generate a worksheet and a presentation | [ ] |
| 10 | Assignments and AI grading | Question builder (all types), file uploads, PDF → online test, student assignment links, submissions, AI grading with teacher confirmation into the gradebook, Google Classroom share | E2E: PDF → test → student submits from link → AI grades → teacher confirms → grade appears in gradebook and report card | [ ] |
| 11 | Educational games | Game creator with every mode via `GameModeRegistry`, validator, play page, scores, leaderboard, progress, grade settings, analytics | Each mode passes the game-mode contract; E2E: create, play and score one game per mode | [ ] |
| 12 | Play to Learn (live) | Practice assignments, PIN join, host dashboard, live questions over `apps/realtime`, self-paced mode, insights | E2E: host + 3 students play a live session; scores and insights correct | [ ] |
| 13 | Adaptive learning and student progress | AI learning paths, student learning links, lesson completion, progress dashboard | Evals meet thresholds; E2E: path generated → student completes a lesson → progress updates | [ ] |
| 14 | Parent and homeschool portals, email | Portal links, homeschool portal and reports, emailing portal links (Resend), trial reminder emails | E2E: teacher emails a portal link → parent sees only confirmed grades and attendance | [ ] |
| 15 | Command Center and Student 360 | Daily dashboard, at-risk detection, to-grade list, recommendations, Student 360 timeline, private notes, AI insight | At-risk rules match `docs/FEATURES.md` examples; E2E: dashboard shows today's classes and an at-risk student | [ ] |
| 16 | Prep Agent | Weekly prep batch (plans → materials → quiz → parent email), progress, preview, edit, approve and publish | Evals meet thresholds; E2E: prompt → batch ready → teacher approves → plans and quiz saved | [ ] |
| 17 | Admin and super admin | School admin (users, roles), super admin (schools, users, password reset, bulk import of teachers and students, overview) | E2E: super admin imports a school's teachers and students; a school admin cannot see another school | [ ] |
| 18 | Marketing site and chatbot | Landing, features and use-case pages, pricing from the plan catalog, legal and trust pages, contact, lead chatbot, leads dashboard, sitemap and robots | Lighthouse SEO ≥ 90 on landing; chatbot evals pass (real prices, says it is an AI when asked) | [ ] |
| 19 | Data migration | Importer from the old MongoDB export and uploaded files into Postgres and file storage; dry run report; old shared links keep working; bcrypt password hashes accepted and rehashed on login | Dry run on a copy of production data: every count matches, spot checks pass, a migrated teacher logs in with their old password | [ ] |
| 20 | Hardening for beta | Security review, privacy review (FERPA/COPPA), rate limits, monitoring, audit log, eval thresholds guarded | Beta checklist complete | [ ] |
| 21 | Launch and cutover | Deploy web, worker and realtime; final migration; DNS for teacherhubpro.com; Stripe webhooks; monitor; shut down the Emergent app | Live site passes the smoke checklist for a week; Emergent subscription cancelled | [ ] |

## Prompt to start each step in Claude Code

```
Read CLAUDE.md, docs/BUILD_STEPS.md and the section for this step in docs/FEATURES.md.
We are on step <N>: <name>.
Enter plan mode and propose: the files and interfaces you'll create, how they follow SOLID,
the legacy behaviours you'll keep (and any you suggest dropping), and the list of tests
(unit, contract, integration, E2E, evals) you'll write first.
Wait for my approval before writing code. Then work test-first, and finish by running
pnpm test && pnpm typecheck && pnpm lint (plus test:int / test:e2e / eval if relevant) and
summarizing results against the Definition of Done.
```
