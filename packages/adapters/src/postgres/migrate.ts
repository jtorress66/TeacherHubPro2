import type { Kysely } from 'kysely';
import { Migrator, NO_MIGRATIONS } from 'kysely/migration';
import type { Result } from '@thp/domain';
import { toMigrationResult, type MigrationOutcome } from './migration-result.ts';
import { migrationProvider } from './migrations/index.ts';
import type { Database } from './schema.ts';

export type { MigrationOutcome } from './migration-result.ts';

const migrator = (db: Kysely<Database>) => new Migrator({ db, provider: migrationProvider });

export const migrateToLatest = async (
  db: Kysely<Database>,
): Promise<Result<MigrationOutcome, string>> =>
  toMigrationResult(await migrator(db).migrateToLatest());

/** Rolls back every migration. For tests and local resets only. */
export const migrateDown = async (
  db: Kysely<Database>,
): Promise<Result<MigrationOutcome, string>> =>
  toMigrationResult(await migrator(db).migrateTo(NO_MIGRATIONS));
