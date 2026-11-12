import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initial from './0001_initial.ts';
import * as accounts from './0002_accounts.ts';
import * as classes from './0003_classes.ts';
import * as attendanceDetails from './0004_attendance_details.ts';
import * as gradebook from './0005_gradebook.ts';
import * as lessonPlanner from './0006_lesson_planner.ts';
import * as assistant from './0007_assistant.ts';
import * as assignments from './0008_assignments.ts';
import * as games from './0009_games.ts';
import * as live from './0010_live.ts';
import * as learning from './0011_learning.ts';
import * as portals from './0012_portals.ts';
import * as formsExports from './0013_forms_exports.ts';
import * as googleQuizzes from './0014_google_quizzes.ts';
import * as dropGoogleQuizzes from './0015_drop_google_quizzes.ts';
import * as student360 from './0016_student_360.ts';
import * as prepBatches from './0017_prep_batches.ts';
import * as admin from './0018_admin.ts';
import * as marketing from './0019_marketing.ts';
import * as planFormat from './0020_plan_format.ts';
import * as hardening from './0021_hardening.ts';
import * as rubrics from './0022_rubrics.ts';
import * as canvaConnections from './0023_canva_connections.ts';
import * as microsoftConnections from './0024_microsoft_connections.ts';
import * as microsoftTeams from './0025_microsoft_teams.ts';
import * as accountProtections from './0026_account_protections.ts';

/** Ordered list of migrations, bundled with the code (no filesystem lookups at runtime). */
const migrations: Readonly<Record<string, Migration>> = {
  '0001_initial': initial,
  '0002_accounts': accounts,
  '0003_classes': classes,
  '0004_attendance_details': attendanceDetails,
  '0005_gradebook': gradebook,
  '0006_lesson_planner': lessonPlanner,
  '0007_assistant': assistant,
  '0008_assignments': assignments,
  '0009_games': games,
  '0010_live': live,
  '0011_learning': learning,
  '0012_portals': portals,
  '0013_forms_exports': formsExports,
  '0014_google_quizzes': googleQuizzes,
  '0015_drop_google_quizzes': dropGoogleQuizzes,
  '0016_student_360': student360,
  '0017_prep_batches': prepBatches,
  '0018_admin': admin,
  '0019_marketing': marketing,
  '0020_plan_format': planFormat,
  '0021_hardening': hardening,
  '0022_rubrics': rubrics,
  '0023_canva_connections': canvaConnections,
  '0024_microsoft_connections': microsoftConnections,
  '0025_microsoft_teams': microsoftTeams,
  '0026_account_protections': accountProtections,
};

export const migrationProvider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};
