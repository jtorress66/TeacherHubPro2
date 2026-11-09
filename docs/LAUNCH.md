# Launch runbook (build step 21)

This runbook moves **teacherhubpro.com** from the old app to this one. Follow the parts in order and tick each box as you go. Everyone starts fresh, because data migration (step 19) was skipped.

**Never paste a key or password into a chat, an issue or this file.** Paste keys only into the settings page named in each step.

Where things are:

- **Render:** https://dashboard.render.com. There are three services: **teacherhubpro-web**, **teacherhubpro-worker** and **teacherhubpro-realtime**.
- **Setting a value on a Render service:** click the service, then **Environment** in the left menu, then **Edit** (or **+ Add Environment Variable**). Type the **Key** exactly as written here (capitals and underscores), paste the **Value**, then click **Save Changes**. If Render asks, choose **Save, rebuild, and deploy**. Wait until the service shows **Live** under **Events** before testing.
- **Logs:** click the service, then **Logs**.

---

## Part 0: Start Google's review first (it can take weeks)

Teachers can sign in with Google today. Connecting **Google Classroom** is different: until Google approves the app, only people listed as **test users** can do it. Google reviews the Classroom and Drive permissions by hand, which takes days to weeks, so start now.

- [ ] Go to https://console.cloud.google.com and pick the project TeacherHubPro uses (project name at the top left).
- [ ] Open **☰ → APIs & Services → Library**. Search for and **Enable** each of these that isn't on yet: **Google Classroom API**, **Google Drive API**, **Google Forms API**, **Google Slides API**.
- [ ] Open **☰ → APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding**):
  - App name **TeacherHubPro**, with your support email and logo.
  - **App domain:** home page `https://teacherhubpro.com`, privacy policy `https://teacherhubpro.com/en/privacy`, terms `https://teacherhubpro.com/en/terms`.
  - **Authorized domains:** `teacherhubpro.com` and `onrender.com`.
- [ ] Under **Audience** (or **Publishing status**), click **Publish app**, then **Prepare for verification** and follow Google's form. Google asks why each permission is needed:
  - **Classroom:** "teachers post assignments and presentations to their own courses."
  - **Drive (drive.file):** "only the files the app creates for the teacher."
  - **Forms:** "make a quiz from the teacher's assignment."
- [ ] Until Google approves: keep adding teachers who need Classroom under **Audience → Test users**.

## Part 1: Paid checks on today's address (onrender.com)

These cost a few dollars in total. Test on **https://teacherhubpro-web.onrender.com** before the domain moves.

- [ ] **Real-Claude scores.**
  1. Open https://github.com/jtorress66/TeacherHubPro2/actions and click **CI** on the left.
  2. Click **Run workflow** → **Run workflow**.
  3. When it finishes, open the run and the **LLM evals** job. Every suite should say it passed its threshold. If one fails, send me a screenshot of that job.
- [ ] **One real prep batch.** In the app, open **Prep Agent**, start a batch for one class, wait for it to finish, then open the plan, slides and quiz. Everything should be written in full, with no "Local …" placeholder text.
- [ ] **Grading and caching.**
  1. Make an assignment with an essay question that uses a rubric.
  2. Hand it in from two student links, and let the AI grade both.
  3. Open **teacherhubpro-worker → Logs** and search for `cache read`. The second submission should show a number above 0.
- [ ] **Optional: the OpenAI voice.** Follow the "Turn on OpenAI's voice" steps below.

<details>
<summary>Turn on OpenAI's voice for Listen (optional, about 1–2 cents per minute of audio)</summary>

1. On https://platform.openai.com, go to **Settings → Billing**, add a card and about $5 of credit.
2. Go to **API keys → + Create new secret key**, name it `TeacherHubPro Listen` and copy the `sk-…` key.
3. On **teacherhubpro-worker**, add `OPENAI_API_KEY` = the key, and `TTS_PROVIDER` = `openai`.
4. On **teacherhubpro-web**, add `TTS_PROVIDER` = `openai`.
5. After both are **Live**, click **Listen** on a saved AI Assistant item. A natural voice should read it after a few seconds. If you hear the device's robotic voice instead, the web service is missing `TTS_PROVIDER`.

</details>

## Part 2: Email (Resend)

Email may already be working: `MAIL_FROM` was set on the verified domain `contact.teacherhubpro.com`.

- [ ] Check that both **teacherhubpro-web** and **teacherhubpro-worker** have `MAIL_PROVIDER` = `resend`, `RESEND_API_KEY` and `MAIL_FROM`. Add any that are missing; the key is under https://resend.com → **API Keys**.
- [ ] Test it:
  1. Log out, click **Forgot password**, and enter your email. The email should arrive within a minute.
  2. Email a parent portal link to yourself from a class's **Portal links** page.

## Part 3: Stripe live mode (real payments)

- [ ] On https://dashboard.stripe.com, finish **Activate payments**: business details, bank account and identity. Stripe won't take live payments without this.
- [ ] Turn **Test mode** **off** (the switch at the top). Open **Developers → API keys** and copy the **Secret key** (`sk_live_…`).
- [ ] Put the live key on Render. Set `STRIPE_SECRET_KEY` = the `sk_live_…` key on **teacherhubpro-web** and on **teacherhubpro-worker**, then save both.
- [ ] Create the live plans and prices:
  1. Open **teacherhubpro-worker → Shell**.
  2. Type `pnpm stripe:setup` and press Enter.
  3. It prints four lines such as `individual_monthly: price_… (created)`. It's safe to run again.
- [ ] Add the webhook (how Stripe tells the app a teacher paid):
  1. In Stripe (test mode off), go to **Developers → Webhooks → + Add endpoint**.
  2. Endpoint URL: `https://teacherhubpro.com/api/billing/webhook`. Use the onrender.com address instead if the domain hasn't moved yet, and change it after Part 4.
  3. Under events, pick `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`.
  4. Click **Add endpoint**, then **Reveal** the **Signing secret** (`whsec_…`).
  5. Set `STRIPE_WEBHOOK_SECRET` = the signing secret on **teacherhubpro-web**.
- [ ] Test it. Buy the monthly plan with your own card on a test teacher account. The account should show the paid plan within a minute. Then refund yourself in Stripe under **Payments → the payment → Refund**.

## Part 4: Move the domain

When this part is done, teacherhubpro.com shows the new app and the old site stops answering. Do it at a quiet time, such as an evening or weekend.

- [ ] On Render, open **teacherhubpro-web → Settings → Custom Domains → + Add Custom Domain**. Add `teacherhubpro.com`. Render adds `www.teacherhubpro.com` too and redirects it.
- [ ] Render shows the DNS records to create, usually an **A** record for `@` and a **CNAME** for `www`. Keep that page open.
- [ ] Sign in where the domain is registered (GoDaddy, Namecheap, Squarespace, Cloudflare or similar) and open the DNS settings for teacherhubpro.com.
  - Replace the **A** record for `@` and the **CNAME** for `www` (they point at the old app) with Render's values.
  - **Do not touch** records for `contact` or `resend`, or the **MX**, **TXT** (SPF, DKIM, DMARC) records. They are your email; deleting them stops email.
  - Delete any **AAAA** record for `@` (the old app's IPv6 address).
- [ ] Back on Render, click **Verify** next to each domain. It can take from minutes to a few hours. Render then issues the HTTPS certificate on its own.
- [ ] Set `APP_URL` = `https://teacherhubpro.com` on **teacherhubpro-web** (no slash at the end), then save and deploy. The worker reads it from the web service on its next deploy, so use **Manual Deploy → Deploy latest commit** on **teacherhubpro-worker**.
- [ ] In Google Cloud, open **☰ → APIs & Services → Credentials → the OAuth 2.0 Client** and add these two **Authorized redirect URIs**. Keep the onrender.com ones.
  - `https://teacherhubpro.com/api/auth/google/callback`
  - `https://teacherhubpro.com/api/classroom/callback`
- [ ] In Stripe, edit the webhook URL to `https://teacherhubpro.com/api/billing/webhook` if it still uses onrender.com.
- [ ] Check it:
  1. Open https://teacherhubpro.com. You should see the new site with a padlock.
  2. Open https://teacherhubpro.com/dashboard. It should land on the login page; old bookmarks are redirected.
  3. Log in with Google.

## Part 5: Cleanup

- [ ] On **teacherhubpro-web**, delete `SUPER_ADMIN_SETUP_KEY` (your owner account already exists).
- [ ] On **teacherhubpro-web**, set `LEADS_NOTIFY_EMAIL` = the address that should get school and district leads from the website.
- [ ] On GitHub, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**. Name it `SMOKE_URL`, with value `https://teacherhubpro.com`.
- [ ] Go to **Actions → Live site check → Run workflow** and confirm it's green.

## Part 6: The first week

- [ ] **Every morning:** the **Live site check** runs at 7:00 (Puerto Rico time). It loads the site in English and Spanish, the prices, the login page, Chat with Ed, and an old address. GitHub emails you if it fails; open the run and send me a screenshot.
- [ ] **On day 1 and on day 7**, do these by hand with a test class:
  - [ ] **Sign up:** create a new teacher account with a new email.
  - [ ] **Attendance:** take attendance for a class and save it.
  - [ ] **Grading:** grade an assignment and confirm the grade in the gradebook.
  - [ ] **Student assignment:** open a student link, hand in work, and check that it appears for the teacher.
  - [ ] **Live game:** host a Play to Learn game and join from a phone.
  - [ ] **Parent portal:** open a portal link and check that only confirmed grades show.
- [ ] Watch **teacherhubpro-worker → Logs** once a day for red error lines.

## Part 7: Shut down the old app

Do this only after a full week with no problems.

- [ ] Download anything you want to keep from the old app (it's gone after cancelling).
- [ ] Cancel the old app's hosting subscription in that platform's billing settings.
- [ ] Remove any DNS records that still point at the old host. Keep the email records from Part 4.
- [ ] Tell me "launch done", and I'll tick step 21 in `docs/BUILD_STEPS.md`.

## If something goes wrong

- **The site is down after the DNS change:** in Render, check that **teacherhubpro-web** is **Live** and the custom domain says **Verified**. DNS can take a few hours to reach everyone.
- **To go back to the old site** (before Part 7 only): restore the old **A**, **CNAME** and **AAAA** records at the registrar, and set `APP_URL` back to `https://teacherhubpro-web.onrender.com`.
- **Payments don't unlock the plan:** in Stripe, open **Developers → Webhooks → the endpoint** and check for failed deliveries. A `400` usually means `STRIPE_WEBHOOK_SECRET` is wrong.
- **"redirect_uri_mismatch" from Google:** the redirect URIs in Part 4 are missing or mistyped.
