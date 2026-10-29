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
pnpm --filter @thp/web dev                                # http://localhost:3000
```

## Database

Postgres 16 runs in Docker for local development. Start Docker Desktop first.

```
cp .env.example .env      # DATABASE_URL for the local database
pnpm db:up                # starts Postgres on localhost:5433 (set POSTGRES_PORT to change)
pnpm db:migrate           # applies pending migrations ("Database is up to date." when none)
```

| Variable       | Used by             | Example                                                      |
| -------------- | ------------------- | ------------------------------------------------------------ |
| `DATABASE_URL` | worker (migrations) | `postgres://teacherhub:teacherhub@localhost:5433/teacherhub` |

The schema lives in `packages/adapters/src/postgres/migrations/`. Each change is a new numbered migration; never edit one that has been merged.

## Commands

```
pnpm test             # unit + contract tests with coverage thresholds
pnpm test:int         # integration tests against a disposable Postgres (needs Docker running)
pnpm test:e2e         # builds the web app and runs Playwright
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
