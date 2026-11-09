# Beta checklist (build step 20)

Ticked items were checked in this repository on 2026-11-08. The items under "Owner, before go-live" need settings or accounts only the owner has.

## Security

- [x] **Rate limits.** Every limit answers "Too many tries" in the visitor's language. Rules are in `packages/domain/src/security/rate-rules.ts`; counts are in Postgres `rate_limits`, keyed by a hash, so no email or address is stored.

  | Action | Limit | Counted by |
  | --- | --- | --- |
  | Log in | 5 tries per 15 min | account |
  | Log in | 50 tries per 15 min | address |
  | Sign up | 20 per hour | address |
  | Forgot password | 5 per hour | address |
  | Contact form | 5 per hour | address |
  | Student hand-in | 30 per hour | student link |
  | Live game join | 300 per 15 min (a whole class shares one school network) | address |
  | Website chat | its own hourly limit | step 18 |

- [x] **Security headers on every reply.** These are HSTS, `nosniff`, no framing (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), a strict referrer policy, camera and location off, `object-src 'none'` and `base-uri 'self'`.
- [x] **Session cookies.** They are `httpOnly` and `SameSite=Lax`, and `Secure` on https.
- [x] **Passwords.** They are hashed; a failed login takes the same time whether or not the account exists, and its message doesn't say which.
- [x] **Student, parent, chat and set-password links.** They are random, stored only as hashes, can be turned off, and expire.
- [x] **Google tokens and other secrets.** They are encrypted at rest, and gitleaks runs in CI.
- [x] **Uploads.** They have size and type checks: attachments, Word documents and school logos.
- [x] **Every use case checks the caller's school and role.** Each one has a test showing another school's data can't be reached; the activity log has its own test.
- [x] **Monitoring.** Render runs health checks on web (`/api/health`) and realtime (`/health`). Worker logs show AI token use and job failures. Google refusals are logged as one line, with no tokens and no content.

## Privacy (FERPA / COPPA)

- [x] **Students have no accounts, emails or passwords.** They use links tied to a roster student ID.
- [x] **Parents see only teacher-confirmed grades and attendance,** through a portal link.
- [x] **AI calls send only the fields a task needs.** No student names where an ID or first name will do; the agents' input types enforce this.
- [x] **Logs hold no prompts, student work or personal data.** The apps write only token counts, job IDs, error codes and Google error reasons.
- [x] **Activity log.** Each school admin (and the owner) sees who changed grades, students, links, roles and school details, and when. It stores IDs only, never names, grades or student work.
- [x] **AI suggests, the teacher decides.** AI grades, insights, prep batches and parent emails stay drafts until approved.

## Quality gates

- [x] **Replay evals in every CI run.** CI scores the saved model replies against `evals/thresholds.json` as part of `pnpm test`, so a drop fails CI.
- [x] **The usual CI gates.** These are coverage thresholds, lint with zero warnings, typecheck, integration tests, E2E in English and Spanish, and the no-Emergent check.

## Owner, before go-live

Step-by-step instructions for each item are in [`docs/LAUNCH.md`](LAUNCH.md).

- [ ] Run the real-Claude evals once (`pnpm eval`, or CI → Run workflow) and check the scores.
- [ ] Check text-to-speech with the real OpenAI voice.
- [ ] Resend: verified domain, `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM`.
- [ ] Stripe live keys and the webhook on the live address.
- [ ] Google: publish the OAuth consent screen (out of Testing mode). Enable the Classroom, Drive, Forms and Slides APIs.
- [ ] Remove `SUPER_ADMIN_SETUP_KEY` from Render once the owner account exists.
- [ ] Optional: an error-tracking service (for example Sentry). It is not added, because it is an outside paid service.
