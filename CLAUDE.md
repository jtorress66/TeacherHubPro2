# CLAUDE.md — TeacherHubPro

TeacherHubPro is an AI workspace for teachers, schools and homeschool families: lesson planning, classes and rosters, attendance, gradebook and report cards, assignments with AI grading, educational games, live classroom games, adaptive learning, parent portals and a weekly lesson-prep agent. The interface is bilingual (Spanish and English).

This repository is a clean rebuild. The previous version, built with Emergent, lives at `github.com/jtorress66/TeacherhubPro` and serves as a **reference only** (see "Legacy app" below).

These rules apply to every session. If a request conflicts with them, stop and ask.

## Non-negotiable rules

1. **One build step at a time.** Work only on the current step in `docs/BUILD_STEPS.md`. Never start the next step until the current one meets the Definition of Done and the user says "next step".
2. **Test first.** For every change: write a failing test (red) → make it pass (green) → refactor. No production code without a test that needed it.
3. **Everything green before you stop.** Before saying a task is done, run and paste the summary of:
   ```
   pnpm test && pnpm typecheck && pnpm lint
   ```
   If anything fails, fix it. Never skip, delete, or weaken a test to make it pass, and never use `.skip`, `.only`, `@ts-ignore`, or `eslint-disable` without the user's explicit approval.
4. **SOLID, always** (see below). If a change would violate a principle, propose a design that doesn't.
5. **Plan before code.** For any new step or feature, first list the files, interfaces, and tests you'll create, and wait for approval.
6. **No Emergent.** Nothing in this repository may reference Emergent: no `emergentintegrations`, no `EMERGENT_*` variables, no `emergent.sh` or `emergentagent.com` URLs, scripts, images or badges. CI fails if `git grep -i emergent` finds anything outside this file and `docs/`.

## Legacy app

- The old app (FastAPI + React + MongoDB) is the specification for **behaviour**, not for code. Read it to learn what a feature does and which edge cases it handled; never copy its code, structure, or Emergent integrations.
- `docs/FEATURES.md` lists every feature, the behaviour to keep, and the old files to read for each build step.
- The old app's bug fixes are requirements. Example: grades once failed to reach reports because submissions were matched to students by typed name; in this app a submission is always tied to a roster student ID.
- Never read or copy the old repo's `cookies.txt`, `memory/test_credentials.md`, `.env` values, or `backend/uploads/`.

## Architecture (ports and adapters)

```
apps/web              Next.js UI (teacher app, admin, marketing site, student and parent link pages) + thin API routes (validate → call use case → return)
apps/worker           background jobs: AI generation, PDF parsing, AI grading, reminders and scheduled emails
apps/realtime         WebSocket server for live Play to Learn sessions
packages/domain       entities, value objects, state machines — NO I/O, NO framework imports
packages/ports        interfaces only
packages/application  use cases: orchestrate domain + ports, return Result — NO I/O, NO framework imports
packages/agents       lesson planner, materials writer, question extractor, grader, game writer, adaptive path, insight, prep agent, chatbot — depend on ports only
packages/adapters     claude, openai-tts, stripe, resend, google (sign-in + classroom), postgres, file storage, pdf text — implement ports
packages/i18n         Spanish and English message catalogs and helpers
packages/testing      fakes, fixtures, shared contract test suites
```

Dependency rule: `domain` ← `ports` ← `application` ← `agents` / `adapters` ← `apps`. Inner packages never import outer ones. `application`, `agents` and `adapters` may import only `domain` and `ports` (tests may also use `testing`). Concrete adapters are wired only in each app's composition root (`src/container.ts`). Enforced by ESLint `no-restricted-imports` and `tests/architecture.test.ts`.

## SOLID checklist

- **S — Single responsibility:** one reason to change per class/module. Route handlers contain no business logic. Agents draft OR grade OR plan, never several.
- **O — Open/closed:** add behaviour by adding a class that implements a port and registering it (e.g. a new game mode in `GameModeRegistry`), not by adding `if/switch` branches on a type field.
- **L — Liskov substitution:** every implementation of a port must pass that port's shared contract suite in `packages/testing/contracts/`. Add the contract test before the implementation.
- **I — Interface segregation:** keep ports small (`LlmClient`, `TextToSpeech`, `FileStore`, `PdfTextExtractor`, `Mailer`, `Clock`, `IdGenerator`, repositories). Split an interface when a consumer uses only part of it.
- **D — Dependency inversion:** depend on ports, inject via constructors. No `new SomeAdapter()` or SDK/database-driver import (e.g. `kysely`, `pg`, `stripe`, `@anthropic-ai/sdk`, `openai`) outside `adapters/` and composition roots. Time, randomness, and IDs come through injected ports so tests are deterministic.

## Testing

| Layer | Tool | Rules |
| --- | --- | --- |
| Unit | Vitest | Domain, use cases, agents with `FakeLlmClient`. No network, no DB. |
| Contract | Vitest shared suites | Every adapter runs the suite for its port. |
| Integration | Vitest + Testcontainers + MSW | Real Postgres; external HTTP via recorded responses. |
| E2E | Playwright | Critical journeys: sign-up, attendance, grading, student assignment, live game, parent portal. Run in Spanish and English. |
| LLM evals | `pnpm eval` | Run when any prompt changes; scores must not drop below `evals/thresholds.json`. |

Coverage thresholds (enforced in CI): `domain` and `agents` ≥ 90%, overall ≥ 80%.
Test names describe behaviour: `it("counts a tardy as present in the attendance rate")`.

## Definition of Done (every step)

- [ ] Tests written first; full suite passes locally
- [ ] Coverage thresholds met
- [ ] `typecheck` and `lint` pass with zero warnings
- [ ] Feature works end to end (E2E test or documented manual check), in Spanish and English
- [ ] No concrete adapter imported into `domain`, `ports`, or `agents`
- [ ] Every legacy behaviour listed for the step in `docs/FEATURES.md` is covered by a test, or the user agreed to drop it
- [ ] README / this file updated if conventions changed
- [ ] Summary posted: what was built, tests added, commands run and their results

## Product safety rules (enforced in code)

- **Students are minors.** Treat all student data as protected under FERPA and COPPA. Collect only what a feature needs.
- **AI suggests, the teacher decides.** AI grades, student insights, at-risk flags, prep-agent batches and parent emails are drafts until the teacher approves them. Report cards, the gradebook total and parent portals show only teacher-confirmed grades.
- **School scoping.** Every read and write is scoped to the caller's school and checked against their role in the use case itself. Each use case has a test proving another school's data is unreachable.
- **Student and parent links.** Students and parents use links, not accounts. Link tokens are random, stored only as hashes, revocable, and expire. A submission is tied to a roster student ID, never matched by a typed name.
- **AI data minimisation.** Send the model only the fields a task needs. Never send student names when an ID or first name suffices. Never log prompts, student work or personal data.
- **No invented facts.** Agents must not invent grades, attendance, standards codes, prices or features. The marketing chatbot states real plan prices from the plan catalog and says it is an AI assistant when asked.
- **Secrets.** Never commit `.env` files, cookies, tokens or credentials. OAuth tokens and API keys are encrypted at rest; never log secrets. gitleaks runs in CI.
- **Official APIs only** for Google, Stripe, Resend, Anthropic and OpenAI.

## Conventions

- TypeScript `strict`; no `any` (use `unknown` and narrow).
- Errors: return typed `Result<T, E>` from use cases; throw only for programmer errors.
- Validate all external input with Zod at the edges.
- Every user-facing string goes through `packages/i18n` with both `es` and `en`. Spanish is the default for new users. AI output follows the language the teacher chose.
- Long AI work (generation, PDF parsing, grading, prep batches) runs as a job in `apps/worker`, stored in Postgres, polled or pushed to the UI. Never hold an HTTP request open for AI.
- Small files, small functions; prefer composition over inheritance.
- Conventional commits; one build step per branch and PR.

## Commands

```
pnpm install
pnpm test          # unit + contract
pnpm test:int      # integration (needs Docker)
pnpm test:e2e      # Playwright
pnpm eval          # LLM evals
pnpm typecheck
pnpm lint
```
