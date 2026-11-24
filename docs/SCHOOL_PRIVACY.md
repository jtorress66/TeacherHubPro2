# School privacy pack (owner guide)

Schools and districts usually ask for a signed student data privacy agreement before they pay. TeacherHubPro offers the Student Data Privacy Consortium's **National Data Privacy Agreement (NDPA)**, which many US districts already use. The public privacy policy (`/en/privacy`) covers schools too: the agreement, where data is kept, the breach notice and the end of a contract.

This guide is not legal advice. Have a lawyer read your filled-in agreement before you sign the first one.

## Before the first agreement

1. **Form the LLC.** The agreement is signed by the business, so use its exact legal name and address once it exists.
2. **Create the mailbox `privacy@teacherhubpro.com`** (or an alias that forwards to you). The website promises this address.
3. **Read the current NDPA** on the Student Data Privacy Consortium's website (search for "SDPC National Data Privacy Agreement"), so you know it before a school asks. A vendor cannot start one alone: the school district, or its state's alliance, starts the agreement in the SDPC registry and sends it to you (see `docs/TRUST_PAPERWORK.md`, step 4).
4. **Fill in the vendor parts** with the answers below. The exhibits ask for them; match each answer to the exhibit that asks for it.
5. **Have a lawyer read it**, then keep the signed copies in one folder.

## Answers for the vendor parts

These match the app as built. If a feature changes, update this list and the website.

**Description of the service:** TeacherHubPro is a web app for teachers and schools: lesson planning, classes and rosters, attendance, gradebook and report cards, assignments with AI-drafted grading that the teacher confirms, educational games, parent links and a weekly lesson-prep assistant. Students and parents use private links, not accounts.

**Student data collected** (only what teachers and schools enter):

- first and last name;
- optional student number;
- optional parent or guardian email;
- optional accommodations (free text the teacher writes);
- optional family language (so the weekly family email can be sent in the language the family reads);
- class membership;
- attendance;
- assignments, student answers and uploaded work;
- grades (AI drafts until the teacher confirms them) and teacher notes.

Students have no accounts, so there is no student email address or password.

**School material (not student data):** a school's admins or account owner can upload the school's own curriculum guides (pacing guides, scope and sequence, unit plans) as PDF or Word files or pasted text. The upload page asks them not to include student information. The text is kept until they remove the guide, it is in the school data download, and it is deleted with the school.

**Where the data is stored:** one Postgres database in Virginia, USA, on Render. Uploaded files are stored in the same database. Uploaded PDFs and curriculum files are deleted once their text is read.

**Service providers (subprocessors):**

| Provider | What it does | What it gets |
| --- | --- | --- |
| Render | hosts the app and the database | all data, stored for the service |
| Stripe | payments | the account holder's billing details, never student data |
| Email provider (Resend) | account emails and messages teachers send families | email addresses and message text |
| Anthropic (Claude) | AI drafts (plans, grading drafts, insights) | only the fields each task needs, plus the school's curriculum guide when a teacher asks the AI to follow it; student names are not sent where an ID or first name will do. Not used to train its models; deleted within 30 days (Anthropic's commercial terms) |
| OpenAI | read-aloud audio | the text being read. Not used to train its models; kept at most 30 days (OpenAI API terms) |
| Google | sign-in and Google Classroom, only when a teacher connects it | what the teacher syncs |
| Canva | only when a teacher connects it | the presentation or worksheet the teacher opens there, never student data |
| Microsoft | only when a teacher connects it | the files the teacher saves to OneDrive, never student data |

**Security:** passwords stored as one-way hashes; student, parent, session and password links random and stored only as hashes, revocable and expiring; Google, Canva and Microsoft tokens encrypted; every record belongs to one school and every action checks the user's school and role; secrets never logged; code scanned for leaked secrets on every change; activity log of grade, student, link and role changes.

**Breach notice:** within 72 hours of discovering a breach that affects the school's data.

**End of contract:** on request, return the school's data as files, then delete it from the service and confirm in writing. A school's admins (or the account owner) can also download everything themselves: Settings → **Download all school data** gives one ZIP of spreadsheets (teachers, classes, students, assignments, grades, attendance, student answers and curriculum guides). Each download is recorded in the activity log. To delete, they use Settings → **Delete all school data** and type the school's name to confirm. A paid plan stops renewing straight away, everyone in the school sees the date the data will be deleted, and they can cancel during the 30-day hold. On that date everything is deleted (accounts, classes, students, work and files), and the only thing kept is a record of IDs and dates, so you can confirm the deletion in writing.

## Questions for the lawyer

- Is the LLC the right party, and who signs for it?
- Are the 72-hour breach notice and the end-of-contract steps written the way you want to commit to them?
- Does a district's state need a state-specific addendum to the NDPA?
- Do the terms of use and privacy policy need changes to match the agreement?
