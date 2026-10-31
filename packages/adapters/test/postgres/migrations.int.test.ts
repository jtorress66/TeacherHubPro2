import { sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, describe, expect, it } from 'vitest';
import { createLessonPlan, type UserId } from '@thp/domain';
import { aSchool, aUser } from '@thp/testing';
import { migrateDown, migrateToLatest } from '../../src/postgres/index.ts';
import { schoolMapper, userMapper } from '../../src/postgres/mappers/school-mappers.ts';
import { migrationProvider } from '../../src/postgres/migrations/index.ts';
import { PostgresLessonPlanRepository } from '../../src/postgres/repositories/postgres-lesson-plan-repository.ts';
import { connect, schoolA, truncateAll } from './test-db.ts';

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
      'ai_generations',
      'assignment_attachments',
      'assignments',
      'attendance_entries',
      'attendance_sessions',
      'classes',
      'classroom_connections',
      'games',
      'grade_categories',
      'grades',
      'jobs',
      'lesson_plans',
      'password_credentials',
      'plan_folders',
      'plan_templates',
      'presentations',
      'report_card_comments',
      'schools',
      'semesters',
      'sessions',
      'stored_files',
      'student_links',
      'students',
      'sub_packets',
      'submissions',
      'subscriptions',
      'users',
    ]);
  });

  it('rolls back completely and applies again', async () => {
    expect(await migrateDown(db)).toEqual({
      ok: true,
      value: {
        applied: [
          '0008_assignments',
          '0007_assistant',
          '0006_lesson_planner',
          '0005_gradebook',
          '0004_attendance_details',
          '0003_classes',
          '0002_accounts',
          '0001_initial',
        ],
      },
    });
    expect(await tableNames()).toEqual([]);

    expect(await migrateToLatest(db)).toEqual({
      ok: true,
      value: {
        applied: [
          '0001_initial',
          '0002_accounts',
          '0003_classes',
          '0004_attendance_details',
          '0005_gradebook',
          '0006_lesson_planner',
          '0007_assistant',
          '0008_assignments',
        ],
      },
    });
    expect(await tableNames()).toHaveLength(27);
  });

  it('turns plans saved before step 8 into valid plans of their kind', async () => {
    const migrator = new Migrator({ db, provider: migrationProvider });
    await truncateAll(db);
    expect((await migrator.migrateTo('0005_gradebook')).error).toBeUndefined();
    await db
      .insertInto('schools')
      .values(schoolMapper.toRow(aSchool({ id: schoolA })))
      .execute();
    await db
      .insertInto('users')
      .values(userMapper.toRow(aUser({ id: 'teacher-1' as UserId, schoolId: schoolA })))
      .execute();
    const old = (id: string, kind: string, title: string | null) =>
      sql`INSERT INTO lesson_plans (id, school_id, teacher_id, kind, title, week_start, days, standards)
          VALUES (${id}, ${schoolA}, 'teacher-1', ${kind}, ${title}, '2026-09-07', '[]', '["X"]')`.execute(
        db,
      );
    await old('old-weekly', 'weekly', null);
    await old('old-ce', 'conversational_english', 'Café');

    expect((await migrateToLatest(db)).ok).toBe(true);
    const plans = await new PostgresLessonPlanRepository(db).listByTeacher(
      schoolA,
      'teacher-1' as UserId,
    );
    expect(plans.map((plan) => plan.body.kind).sort()).toEqual([
      'conversational_english',
      'weekly',
    ]);
    for (const plan of plans) {
      expect(createLessonPlan({ ...plan, body: plan.body }).ok, plan.id).toBe(true);
    }
    await truncateAll(db);
  });
});
