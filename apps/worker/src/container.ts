import { createDatabase, migrateToLatest } from '@thp/adapters';
import type { DatabaseConfig } from './config.ts';

// Composition root: the only place in the worker where concrete adapters are created.
export const container = {} as const;

/** Opens a connection, applies pending migrations and closes it again. */
export async function runMigrations({ databaseUrl }: DatabaseConfig) {
  const db = createDatabase(databaseUrl);
  try {
    return await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
}
