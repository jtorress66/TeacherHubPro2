# TeacherHubPro

AI workspace for teachers, schools and homeschool families: lesson planning, classes, attendance, gradebook and report cards, assignments with AI grading, educational and live games, adaptive learning, parent portals and a weekly lesson-prep agent. Available in English, Spanish, French, Portuguese, German, Italian and Chinese (English and Spanish fully translated; the others fall back to English for now).

This is a clean rebuild of the original app, built step by step with Claude Code.

- `CLAUDE.md` — rules for every Claude Code session
- `docs/BUILD_STEPS.md` — the build plan, one step at a time
- `docs/FEATURES.md` — everything the original app does, by build step

## Getting started

Requires Node 24 and pnpm 12 (`corepack enable` picks the version from `package.json`).

```
pnpm install
pnpm --filter @thp/web exec playwright install chromium   # once, for E2E
cp .env.example .env                                      # local stand-ins for Stripe and Google
pnpm db:up && pnpm db:migrate                             # Docker Desktop must be running
pnpm --filter @thp/web dev                                # http://localhost:3000
```

With the defaults in `.env.example` everything runs locally without any keys:

- **Billing** uses an in-app test checkout. Its "Pay" button sends a signed webhook through the same endpoint Stripe uses.
- **Google sign-in** uses an in-app test account picker.

The app refuses both stand-ins when `APP_ENV=production`.

## Database

Postgres 16 runs in Docker for local development. Start Docker Desktop first.

```
cp .env.example .env      # DATABASE_URL for the local database
pnpm db:up                # starts Postgres on localhost:5433 (set POSTGRES_PORT to change)
pnpm db:migrate           # applies pending migrations ("Database is up to date." when none)
```

| Variable                                                                                    | Used by     | Example                                                      |
| ------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `DATABASE_URL`                                                                              | web, worker | `postgres://teacherhub:teacherhub@localhost:5433/teacherhub` |
| `APP_URL`, `APP_ENV`                                                                        | web         | `http://localhost:3000`, `development`                       |
| `BILLING_PROVIDER` + `LOCAL_BILLING_SECRET` or `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`  | web         | see `.env.example`                                           |
| `GOOGLE_AUTH_PROVIDER` + `LOCAL_GOOGLE_SECRET` or `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` | web         | see `.env.example`                                           |

The schema lives in `packages/adapters/src/postgres/migrations/`. Each change is a new numbered migration; never edit one that has been merged.

## Billing (Stripe test mode)

Plans and prices come from `packages/domain/src/billing/plan-catalog.ts`. Stripe finds them by lookup key (`thp_individual_monthly`, `thp_individual_yearly`, `thp_school_seat_yearly`, `thp_district_seat_yearly`).

To use real Stripe test mode locally:

1. In the Stripe Dashboard, turn on **Test mode**, open **Developers → API keys** and copy the **Secret key** (`sk_test_…`).
2. `STRIPE_SECRET_KEY=sk_test_… pnpm stripe:setup` creates the products and prices (safe to run again).
3. `stripe listen --forward-to localhost:3000/api/billing/webhook` (Stripe CLI) prints a `whsec_…` secret.
4. In `.env`, set `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, then start the app.

**CI (`e2e-stripe` job).** Add the test key as a repository secret:

1. On GitHub, open the repository → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name it `STRIPE_SECRET_KEY` and paste the `sk_test_…` key.

Never use a live key (`sk_live_…`): the job refuses it. The job creates the prices, forwards webhooks with the Stripe CLI and buys a plan with Stripe's test card.

## Google sign-in

1. In Google Cloud Console, open **APIs & Services → Credentials** and create an **OAuth client ID** of type _Web application_.
2. Add the authorized redirect URI `<APP_URL>/api/auth/google/callback`.
3. In `.env`, set `GOOGLE_AUTH_PROVIDER=google`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Accounts are matched by email only when Google says the email is verified.

## Importing students (CSV)

On a class page, **Import students from a CSV file** adds a whole roster at once. The first row names the columns, in English or Spanish, without regard to case or accents. Values can be separated by commas or semicolons (Spanish Excel uses semicolons).

| Column         | Required | Accepted header names (examples)         |
| -------------- | -------- | ---------------------------------------- |
| First name     | yes      | `First name`, `Nombre`                   |
| Last name      | yes      | `Last name`, `Apellidos`                 |
| Student number | no       | `Student number`, `Número de estudiante` |
| Parent email   | no       | `Parent email`, `Correo del padre`       |
| Accommodations | no       | `Accommodations`, `Adaptaciones`         |

Samples: `apps/web/public/samples/students-en.csv` and `students-es.csv`. At most 500 students per file. If any row has a problem, nothing is imported and every bad row is listed with its line number.

## Attendance

On a class page, **Take attendance** opens the sheet for a day (today by default). Everyone starts as present; set the others, add minutes late for tardies and a note if needed, then **Save** or **Submit**. A submitted day is read-only until it is reopened. **Attendance report** shows each student's counts and rate over submitted days (last 30 days by default). Tardy counts as present; excused days count in the total. **Attendance** in the menu shows every class and whether the day was taken.

## Gradebook and report cards

On a class page, **Gradebook** shows every student against every assignment with their weighted overall grade and letter. Start with **Use standard categories** (Homework 25%, Quiz 25%, Test 30%, Project 20%) or add your own, then create assignments (title, category, points, due date). Click an assignment to enter the whole class's scores at once: a score counts as graded unless you mark it late; leave it blank to keep it pending; missing counts as 0 and excused is left out. **Gradebook report** shows the class average, GPA and the A–F distribution. **Report cards** lets you save a comment per student and download one student's report card, or the whole class's, as a PDF with the school logo (uploaded in **Settings**, PNG or JPEG up to 1 MB), grades by category, overall grade and GPA, and attendance over the class's semester.

## Lesson planner and the worker

**Lesson plans** in the menu lists your plans (latest first), filtered by **All**, **Unfiled** or a folder, as a list or a month **Calendar**. A weekly plan holds one or two weeks, each with an objective, up to four skills, Common Core codes, expectations and Monday–Friday days (theme, Depth of Knowledge, day type, activity and material checklists, notes). A **Conversational English** plan has a title, lesson dates and its own sections. Plans can be duplicated to another week, moved between folders, saved as templates and printed (the print page renders tables and fill-in-the-blank lines; use the browser's _Save as PDF_ for a PDF). **Templates** has five starter weeks in English and Spanish, a template of the week, and your own templates.

**Draft a plan with AI** queues a job: the page polls until the worker has drafted the plan, then opens it in the editor to review, edit and save. Nothing is saved until you press Save. The AI may cite only official Common Core codes (Math and ELA, plus the 6–12 literacy codes for science and social studies), imported once with `pnpm standards:import` from the Common Standards Project (CC BY 3.0 US) into `packages/domain/src/standards/common-core-codes.ts`; any other code is dropped. **Browse Common Core codes** lists them by subject and grade.

Jobs live in Postgres. Run the worker next to the web app:

```
pnpm --filter @thp/worker start   # LLM_PROVIDER=local drafts with a scripted stand-in; set ANTHROPIC_API_KEY for Claude
```

A job not finished 5 minutes after it was created reads as timed out, and the worker stores that. E2E tests start the worker with the stand-in automatically.

**Evals.** `pnpm eval` runs three suites against real Claude: the planner, the AI assistant (eight cases, every content type and language: structure, language, valid codes, quiz question count) and presentations (four cases: structure, language, slide count, titles). The planner suite drafts ten fixed plans (every interface language, each subject, and a grade with no Common Core codes) with real Claude and scores structure, language, valid and relevant codes and completeness against `evals/thresholds.json`. It needs `ANTHROPIC_API_KEY` in `.env` and costs money, so it runs only when asked. In CI the `evals` job runs only when started by hand (Actions → CI → Run workflow) and needs the `ANTHROPIC_API_KEY` repository secret. Every push instead scores **saved replies** (`evals/replays/*.json`, one per case, written to match the prompts' shapes) with the same scorecards and thresholds, as part of `pnpm test`, at no cost. They catch regressions in parsing, validation and scoring; how the model itself behaves needs a real run. The model defaults to `claude-opus-5-5`; set `ANTHROPIC_MODEL` to change it.

## AI assistant, presentations and voice

The **AI assistant** (`/app/assistant`) writes worksheets, quizzes, topic summaries, class activities and free-form lesson plans as Markdown, in the language the teacher picks; everything it writes is kept in the teacher's history, with copy, print and Listen. **Presentations** (`/app/presentations`) are drafted by Claude or started blank, edited slide by slide (layouts, emoji, themes, transitions), shown full screen in present mode and printed one slide per page. Each class has a **substitute packet** (`/app/classes/<id>/sub-packet`) with saved notes and a print page.

**Voice.** Listen reads text aloud with OpenAI text-to-speech. The worker makes the audio (`TTS_PROVIDER=openai` with `OPENAI_API_KEY`; voice `OPENAI_TTS_VOICE`, default `nova`, which the web app must share) and caches it per school; without a key it uses a silent local stand-in.

## Commands

```
pnpm test             # unit + contract tests with coverage thresholds
pnpm test:int         # integration tests against a disposable Postgres (needs Docker running)
pnpm test:e2e         # builds the web app and runs Playwright (needs `pnpm db:up && pnpm db:migrate`)
pnpm test:e2e:stripe  # the Stripe test-mode journey (CI job e2e-stripe; needs a running app on :3000)
pnpm stripe:setup     # creates the Stripe products and prices (STRIPE_SECRET_KEY)
pnpm eval             # planner, assistant and presentation evals against Claude (needs ANTHROPIC_API_KEY)
pnpm standards:import # re-imports the Common Core codes (network)
pnpm typecheck
pnpm lint             # zero warnings allowed
pnpm check:forbidden  # the legacy-platform reference check CI runs
```

## Layout

```
apps/web        Next.js app; routes are prefixed with the language (/en, /es, ...)
apps/worker     background jobs; `pnpm db:migrate` CLI
apps/realtime   live game WebSocket server (stub)
packages/*      domain, ports, application, agents, adapters (Postgres via Kysely), i18n, testing
tests/          architecture tests (dependency rule, SDK boundaries)
scripts/        repository checks
```

## Languages

Messages live in `packages/i18n/src/catalogs/`. `en.ts` defines every key; `es.ts` must match it exactly (a compile error otherwise). `fr`, `pt`, `de`, `it` and `zh` may leave keys out, and missing keys show in English. The language comes from a `?lang=` link, then the saved choice (`teacherhub_language` cookie), then English.
