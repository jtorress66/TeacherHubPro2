import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initial from './0001_initial.ts';
import * as accounts from './0002_accounts.ts';
import * as classes from './0003_classes.ts';
import * as attendanceDetails from './0004_attendance_details.ts';
import * as gradebook from './0005_gradebook.ts';
import * as lessonPlanner from './0006_lesson_planner.ts';
import * as assistant from './0007_assistant.ts';
import * as assignments from './0008_assignments.ts';

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
};

export const migrationProvider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};
