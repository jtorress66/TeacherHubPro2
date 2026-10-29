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

## Commands

```
pnpm test             # unit + contract tests with coverage thresholds
pnpm test:int         # integration tests against a disposable Postgres (needs Docker running)
pnpm test:e2e         # builds the web app and runs Playwright (needs `pnpm db:up && pnpm db:migrate`)
pnpm test:e2e:stripe  # the Stripe test-mode journey (CI job e2e-stripe; needs a running app on :3000)
pnpm stripe:setup     # creates the Stripe products and prices (STRIPE_SECRET_KEY)
pnpm eval             # LLM evals (from step 8)
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
