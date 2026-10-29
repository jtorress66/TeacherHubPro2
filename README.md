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

## Commands

```
pnpm test             # unit + contract tests with coverage thresholds
pnpm test:int         # integration tests (needs Docker; from step 3)
pnpm test:e2e         # builds the web app and runs Playwright
pnpm eval             # LLM evals (from step 8)
pnpm typecheck
pnpm lint             # zero warnings allowed
pnpm check:forbidden  # the legacy-platform reference check CI runs
```

## Layout

```
apps/web        Next.js app; routes are prefixed with the language (/en, /es, ...)
apps/worker     background jobs (stub)
apps/realtime   live game WebSocket server (stub)
packages/*      domain, ports, application, agents, adapters, i18n, testing
tests/          architecture tests (dependency rule, SDK boundaries)
scripts/        repository checks
```

## Languages

Messages live in `packages/i18n/src/catalogs/`. `en.ts` defines every key; `es.ts` must match it exactly (a compile error otherwise). `fr`, `pt`, `de`, `it` and `zh` may leave keys out, and missing keys show in English. The language comes from a `?lang=` link, then the saved choice (`teacherhub_language` cookie), then English.
