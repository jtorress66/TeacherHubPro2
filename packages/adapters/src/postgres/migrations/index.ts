import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initial from './0001_initial.ts';

/** Ordered list of migrations, bundled with the code (no filesystem lookups at runtime). */
const migrations: Readonly<Record<string, Migration>> = {
  '0001_initial': initial,
};

export const migrationProvider: MigrationProvider = {
  getMigrations: () => Promise.resolve(migrations),
};
