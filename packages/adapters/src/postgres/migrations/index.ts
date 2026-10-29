import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initial from './0001_initial.ts';
import * as accounts from './0002_accounts.ts';
import * as classes from './0003_classes.ts';
import * as attendanceDetails from './0004_attendance_details.ts';

/** Ordered list of migrations, bundled with the code (no filesystem lookups at runtime). */
const migrations: Readonly<Record<string, Migration>> = {
  '0001_initial': initial,
  '0002_accounts': accounts,
  '0003_classes': classes,
  '0004_attendance_details': attendanceDetails,
};

export const migrationProvider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};
