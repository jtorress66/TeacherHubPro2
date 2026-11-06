# Moving the old app's data

This guide copies the old app's MongoDB data (on Atlas) into the new Postgres database on Render. You run it from your own computer in PowerShell. Nothing here needs a password in a file, in the repository or in a chat: you type each secret into the terminal when asked.

The export holds student data. Keep it **outside the repository** (the command refuses a folder inside it), and delete it when you are done.

## 1. Install the MongoDB Database Tools

Download them from MongoDB's site: <https://www.mongodb.com/try/download/database-tools>. Check that they work:

```powershell
mongoexport --version
```

## 2. Export the old data

In Atlas, open the cluster, choose **Connect → Drivers**, and copy the connection string. Put the database name before the `?`, e.g. `mongodb+srv://user:<password>@cluster0.example.mongodb.net/teacherhub?retryWrites=true`.

```powershell
$uri = Read-Host -MaskInput "Atlas connection string"
New-Item -ItemType Directory -Force C:\thp-export | Out-Null
$collections = @(
  'schools', 'users', 'subscriptions', 'semesters', 'classes', 'students',
  'plan_folders', 'lesson_plans', 'ai_templates', 'attendance_sessions', 'attendance_records',
  'grade_categories', 'assignments', 'ai_assignments', 'grades', 'ai_submissions',
  'educational_games', 'game_scores', 'presentations', 'ai_generations',
  'adaptive_learning_paths', 'adaptive_learning_progress',
  'portal_tokens', 'homeschool_portal_tokens', 'student_learning_tokens',
  'student_notes', 'student_insights', 'sub_packets', 'trial_reminders', 'leads',
  'practice_assignments', 'practice_sessions', 'practice_results'
)
foreach ($c in $collections) { mongoexport --uri=$uri --collection=$c --out="C:\thp-export\$c.json" }
Remove-Variable uri
```

Sessions, jobs and chat logs are not exported. They are not carried over, and the session collection holds log-in tokens.

## 3. Dry run

The dry run reads everything, checks it against the new app's rules, and prints what it would do. It writes nothing. It needs the database so it can recognise accounts that already exist (for example yours).

In the Render dashboard, open the database, copy the **External Database URL**, and then run:

```powershell
cd C:\Users\juanh\TeacherHubPro2
$env:DATABASE_URL = Read-Host -MaskInput "Render external database URL"
pnpm migrate:legacy --from C:\thp-export
```

The report has one line per collection: how many records were read, imported and skipped, with a reason for each skip and notes on what changed. It shows counts only, never names or emails. If a line ends with "Counts do not add up", stop and share the report.

Common reasons:

| Reason | Meaning |
| --- | --- |
| `transient` | Sessions, jobs and play progress, which are not carried over. |
| `role_without_accounts` | A parent record; families use links, not accounts. |
| `school_not_found`, `class_not_found`, `teacher_not_found`, `student_not_found` | The record points at something that no longer exists in the old data. |
| `student_name_not_matched` | An old submission whose typed name matches nobody, or several students, in the class roster. It is never guessed. |
| `expired` | An old family or learning link that had already expired. |
| `kept_as_grades` | Old game scores. Their grades are already in the gradebook. |
| `invalid_<field>_<problem>` | The record breaks a rule of the new app, such as a blank name or a bad date. |
| `matched_existing_account` (note) | The person already has an account here, so their old data joins it. |
| `shared_link_retired`, `attachment_not_copied`, `logo_not_copied` (notes) | Old assignment links and uploaded files are not carried over. |

Paste the report back to Claude (it contains no personal data). Any mapping gaps get fixed before the real import.

## 4. Import

Once the dry run looks right, run the same command with `--apply`:

```powershell
pnpm migrate:legacy --from C:\thp-export --apply
```

Running it again updates the same records instead of adding copies. A password someone already set in the new app is never replaced.

## 5. Check

- Log in on the new site with an old account and its **old password**. It works, and the password is upgraded to the new format at that log-in.
- Spot-check a class and its roster, a lesson plan, a gradebook and a family portal link.

## 6. Clean up

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item -Recurse -Force C:\thp-export
```

## Old links

After the old domain points at the new site:

- `/portal/…` and `/homeschool-portal/…` open the family portal.
- `/student-learning/…` opens the student's page.
- `/assignment/…` and `/play-game/…` show a page asking the student for their new personal link. The old links matched students by a typed name, which the new app never does.
