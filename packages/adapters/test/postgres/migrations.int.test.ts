import { sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, describe, expect, it } from 'vitest';
import { createLessonPlan, type UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { migrateDown, migrateToLatest } from '../../src/postgres/index.ts';
import { userMapper } from '../../src/postgres/mappers/school-mappers.ts';
import { migrationProvider } from '../../src/postgres/migrations/index.ts';
import { PostgresMicrosoftConnectionRepository } from '../../src/postgres/repositories/postgres-assignment-repositories.ts';
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
      'audit_events',
      'canva_connections',
      'chat_sessions',
      'chat_turns',
      'classes',
      'classroom_connections',
      'forms_exports',
      'game_plays',
      'games',
      'grade_categories',
      'grades',
      'jobs',
      'leads',
      'learning_paths',
      'lesson_attempts',
      'lesson_plans',
      'live_answers',
      'live_players',
      'live_sessions',
      'microsoft_connections',
      'password_credentials',
      'password_tokens',
      'plan_folders',
      'plan_templates',
      'portal_links',
      'prep_batches',
      'presentations',
      'rate_limits',
      'report_card_comments',
      'rubrics',
      'schools',
      'semesters',
      'sent_mail',
      'sessions',
      'stored_files',
      'student_insights',
      'student_links',
      'student_notes',
      'students',
      'sub_packets',
      'submissions',
      'subscriptions',
      'trial_reminders',
      'users',
    ]);
  });

  it('rolls back completely and applies again', async () => {
    expect(await migrateDown(db)).toEqual({
      ok: true,
      value: {
        applied: [
          '0025_microsoft_teams',
          '0024_microsoft_connections',
          '0023_canva_connections',
          '0022_rubrics',
          '0021_hardening',
          '0020_plan_format',
          '0019_marketing',
          '0018_admin',
          '0017_prep_batches',
          '0016_student_360',
          '0015_drop_google_quizzes',
          '0014_google_quizzes',
          '0013_forms_exports',
          '0012_portals',
          '0011_learning',
          '0010_live',
          '0009_games',
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
          '0009_games',
          '0010_live',
          '0011_learning',
          '0012_portals',
          '0013_forms_exports',
          '0014_google_quizzes',
          '0015_drop_google_quizzes',
          '0016_student_360',
          '0017_prep_batches',
          '0018_admin',
          '0019_marketing',
          '0020_plan_format',
          '0021_hardening',
          '0022_rubrics',
          '0023_canva_connections',
          '0024_microsoft_connections',
          '0025_microsoft_teams',
        ],
      },
    });
    expect(await tableNames()).toHaveLength(49);
  });

  it('turns plans saved before step 8 into valid plans of their kind', async () => {
    const migrator = new Migrator({ db, provider: migrationProvider });
    await truncateAll(db);
    expect((await migrator.migrateTo('0005_gradebook')).error).toBeUndefined();
    // A school as stored at 0005, before later columns (such as plan_format) existed.
    await sql`INSERT INTO schools (id, name) VALUES (${schoolA}, 'Lincoln')`.execute(db);
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

  it('keeps Microsoft connections made before Teams as OneDrive only', async () => {
    const migrator = new Migrator({ db, provider: migrationProvider });
    await truncateAll(db);
    expect((await migrator.migrateTo('0024_microsoft_connections')).error).toBeUndefined();
    await sql`INSERT INTO schools (id, name) VALUES (${schoolA}, 'Lincoln')`.execute(db);
    await db
      .insertInto('users')
      .values(userMapper.toRow(aUser({ id: 'teacher-1' as UserId, schoolId: schoolA })))
      .execute();
    await sql`INSERT INTO microsoft_connections (teacher_id, school_id, encrypted_refresh_token, connected_at)
        VALUES ('teacher-1', ${schoolA}, 'sealed', now())`.execute(db);

    expect((await migrateToLatest(db)).ok).toBe(true);
    const connection = await new PostgresMicrosoftConnectionRepository(db).find(
      schoolA,
      'teacher-1' as UserId,
    );
    expect(connection).toMatchObject({ encryptedRefreshToken: 'sealed', teams: false });
    await truncateAll(db);
  });
});
