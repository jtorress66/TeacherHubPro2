import type { MigrationResultSet } from 'kysely/migration';
import { err, ok, type Result } from '@thp/domain';

export interface MigrationOutcome {
  /** Names of the migrations that ran in this call, in order. */
  readonly applied: readonly string[];
}

export function toMigrationResult({
  error,
  results = [],
}: MigrationResultSet): Result<MigrationOutcome, string> {
  if (error !== undefined) {
    return err(error instanceof Error ? error.message : 'Unknown migration error');
  }
  return ok({ applied: results.filter((r) => r.status === 'Success').map((r) => r.migrationName) });
}
