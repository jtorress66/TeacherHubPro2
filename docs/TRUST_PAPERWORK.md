# Trust paperwork: what schools check before they buy

A plain guide for the owner, in the order to do things. Schools compare vendors on this paperwork as much as on features. The research behind it (sources and dates) is in `C:\Users\juanh\TeacherHubPro-research\` (report: "TeacherHubPro competitor gap analysis", notes: "trust_paperwork_facts.md"), read on 2026-11-20. Prices change, so check each one before paying.

This guide is not legal advice.

## Already done in the app

| What schools ask for | Where it is |
| --- | --- |
| Privacy policy (one page, seven languages) | teacherhubpro.com/en/privacy |
| Accessibility statement | teacherhubpro.com/en/accessibility |
| Accessibility report ("VPAT") | `docs/ACCESSIBILITY_REPORT.md`: send it when asked |
| AI rules (drafts only, least data, AI providers do not train on it) | teacherhubpro.com/en/ai-governance |
| FERPA and COPPA pages, trust center | /en/ferpa, /en/coppa, /en/trust |
| Answers for privacy agreements and security questions | `docs/SCHOOL_PRIVACY.md` |
| School data download and deletion | Settings → Download / Delete all school data |
| Admin controls: usage by teacher, AI on/off, student flags on/off (each change logged) | School overview (menu, for school admins and the account owner) |
| Breach notice promise: 72 hours | privacy page, section 8 |

## Step 1: form the LLC (needed before anything is signed)

Agreements are signed by the business, so this comes first.

1. Go to the Puerto Rico Departamento de Estado's online corporations registry (Registro de Corporaciones y Entidades).
2. File a **Certificate of Organization** for a limited liability company (form 34-CORPLLC02).
3. **Fee:** about **$250**, with faster processing for about $100–$200 more and an annual fee of about $150. These figures come from secondary sources; the official fee page could not be reached, so check it there.
4. Get an EIN from the IRS (free, online), and open a business bank account.
5. Tell me the LLC's exact legal name and address, and I'll put them in the terms and the privacy page.

## Step 2: the lawyer review (one meeting, bring this list)

1. **The NDPA** (the national student data privacy agreement): read it with you before the first signature.
2. **Puerto Rico Ley 185-2024** (online privacy of minors, 27 August 2024).
   - It seems aimed at social networks that publish minors' information.
   - Ask whether it applies to software a school hires.
   - Ask whether the app's **"students who may need help"** flags and **student insights** count as profiling. A school can already turn them off for everyone (School overview → School-wide switches); ask whether they should start **off** for Puerto Rico schools.
3. **Puerto Rico Ley 111-2005** (data breaches).
   - It requires telling DACO (the consumer affairs department) within **10 days** of finding a breach, and the affected people as quickly as possible. Rules: DACO Regulation 7376.
   - Our privacy page promises schools notice within 72 hours. Ask the lawyer to confirm the steps and who notifies families: us or the school.
4. **Terms of use and privacy page:** do they match the agreement?
5. **Pending AI bills** in Puerto Rico (Senate bill 348-2025, House bill 968): ask what to watch for.

## Step 3: free and cheap trust items (this month)

- **Common Sense Privacy: free risk assessment.**
  - Ask for it at commonsenseprivacy.net/assessment. It shows what an official review would flag, at no cost.
  - The Common Sense **Privacy Seal** is paid (price only after a demo). Fewer than 1 in 10 products evaluated earn it. Decide after the free assessment.
- **List of service providers (sub-processors):** already on the privacy page (Render, Stripe, Resend, Anthropic, OpenAI, Google, Canva, Microsoft). Tell me when one changes.
- **Keep `privacy@teacherhubpro.com` answered within a few days.** Schools test it.

## Step 4: student data privacy agreements (when a school asks)

How the NDPA really works:
- **A vendor cannot sign it alone.** A school district, or a state's group of districts (an "alliance"), starts the agreement in the SDPC registry. The vendor then signs that state's version.
- After one district in a state signs, other districts in the same state can join through **"Exhibit E"** (the general offer) without the vendor signing again.
- **States with alliances (2026):** AZ, AR, CA, FL, IL, IA, ME, MA, MI (add-on terms only), MO, MT, NE, NH, OR, PA, RI, SC, TN, UT, VT, VA, WA and WI. Texas uses its own alliance.
- **Puerto Rico has no alliance.** A Puerto Rico school can still use the NDPA text as a normal contract, or its own agreement. Ask the lawyer (Step 2).
- **Seeing the registry** requires an Access 4 Learning (A4L) membership. Its price was not found; ask A4L before paying.
- To withdraw a general offer later (for example, if the service changes), write to ndpa_requests@A4L.org.

**What to do:** when a school asks, reply that you'll sign the NDPA, and send the answers in `docs/SCHOOL_PRIVACY.md`. The school starts the agreement in the registry; you review it with the lawyer and sign.

## Step 5: wait until a US district is close to buying

These cost real money. They matter mainly for district-wide contracts, not for individual teachers, homeschool families or small private schools.

| Item | What it is | Cost and time |
| --- | --- | --- |
| **1EdTech TrustEd Apps** | A privacy certification many districts look for. | Needs a 1EdTech membership (price not found; write to TrustEdApps@1edtech.org). |
| **SOC 2 Type II** | An outside audit of security practices. | First year about **$25,000–$50,000**: compliance software about $7,500–$18,000 a year, plus an auditor about $10,000–$45,000. Takes **6–12 months**. A quicker "Type I" takes 2–4 months. |
| **Clever / ClassLink** | How large districts send class rosters. | Built on request. Clever charges the vendor, and its rules forbid passing that fee to schools. |
| **Screen reader testing** | Real users of NVDA, JAWS and VoiceOver try the app. | Paid testers; makes the accessibility report stronger. |

## Keeping it true

When a feature, provider or practice changes, the privacy page, the AI governance page, `docs/SCHOOL_PRIVACY.md` and `docs/ACCESSIBILITY_REPORT.md` must change with it. Tests check some of this, for example that the privacy page names every provider and the Settings buttons.
