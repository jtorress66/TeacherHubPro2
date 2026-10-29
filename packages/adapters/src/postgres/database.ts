import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.ts';

const DATE_TYPE_ID = 1082;

/**
 * A Kysely connection pool. `date` columns are returned as the YYYY-MM-DD text Postgres sends,
 * which is exactly the domain's LocalDate, instead of a JS Date shifted by the local time zone.
 */
export function createDatabase(connectionString: string): Kysely<Database> {
  const types = new pg.TypeOverrides();
  types.setTypeParser(DATE_TYPE_ID, (value: string) => value);
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, types }) }),
  });
}
