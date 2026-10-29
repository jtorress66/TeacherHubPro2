import { describe, expect, it } from 'vitest';
import { parseDatabaseConfig } from './config.ts';

describe('parseDatabaseConfig', () => {
  it('reads a Postgres connection string from DATABASE_URL', () => {
    expect(parseDatabaseConfig({ DATABASE_URL: 'postgres://thp:thp@localhost:5432/thp' })).toEqual({
      ok: true,
      value: { databaseUrl: 'postgres://thp:thp@localhost:5432/thp' },
    });
    expect(parseDatabaseConfig({ DATABASE_URL: 'postgresql://db.internal/thp' }).ok).toBe(true);
  });

  it('is an error when DATABASE_URL is missing', () => {
    expect(parseDatabaseConfig({})).toEqual({
      ok: false,
      error: 'DATABASE_URL is required (postgres://user:password@host:port/database).',
    });
  });

  it('is an error when DATABASE_URL is not a Postgres address', () => {
    expect(parseDatabaseConfig({ DATABASE_URL: 'mysql://localhost/thp' }).ok).toBe(false);
    expect(parseDatabaseConfig({ DATABASE_URL: 'not a url' }).ok).toBe(false);
  });
});
