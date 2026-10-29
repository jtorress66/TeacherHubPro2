import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { migrateDown, migrateToLatest } from '../../src/postgres/index.ts';
import { connect } from './test-db.ts';

const db = connect();
afterAll(() => db.destroy());

const tableNames = async (): Promise<string[]> => {
  const { rows } = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT LIKE 'kysely_%'
    ORDER BY table_name`.execute(db);
  return rows.map((row) => row.table_name);
};

describe('migrations', () => {
  it('the test database is already at the latest schema, so nothing runs again', async () => {
    expect(await migrateToLatest(db)).toEqual({ ok: true, value: { applied: [] } });
  });

  it('creates every table', async () => {
    expect(await tableNames()).toEqual([
      'assignments',
      'attendance_entries',
      'attendance_sessions',
      'classes',
      'games',
      'grade_categories',
      'grades',
      'lesson_plans',
      'password_credentials',
      'schools',
      'semesters',
      'sessions',
      'students',
      'submissions',
      'subscriptions',
      'users',
    ]);
  });

  it('rolls back completely and applies again', async () => {
    expect(await migrateDown(db)).toEqual({
      ok: true,
      value: { applied: ['0002_accounts', '0001_initial'] },
    });
    expect(await tableNames()).toEqual([]);

    expect(await migrateToLatest(db)).toEqual({
      ok: true,
      value: { applied: ['0001_initial', '0002_accounts'] },
    });
    expect(await tableNames()).toHaveLength(16);
  });
});
