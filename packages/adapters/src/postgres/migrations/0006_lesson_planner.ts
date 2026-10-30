import { sql, type Kysely } from 'kysely';
import { folderColors, jobStatuses, lessonPlanKinds } from '@thp/domain';

const inList = (column: string, values: readonly string[]) =>
  sql`${sql.ref(column)} IN (${sql.join(values.map((value) => sql.lit(value)))})`;

/**
 * Background jobs, plan folders and templates, and lesson plans whose content is one validated
 * JSON body per kind (weekly with one or two weeks, or Conversational English).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('jobs')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('owner_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('payload', 'jsonb', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('queued'))
    .addColumn('result', 'jsonb')
    .addColumn('error', 'text')
    .addColumn('attempts', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
    .addColumn('started_at', 'timestamptz')
    .addColumn('finished_at', 'timestamptz')
    .addCheckConstraint('jobs_status_check', inList('status', jobStatuses))
    .execute();
  await db.schema
    .createIndex('jobs_status_kind_created_at_idx')
    .on('jobs')
    .columns(['status', 'kind', 'created_at'])
    .execute();
  await db.schema
    .createIndex('jobs_school_id_owner_id_idx')
    .on('jobs')
    .columns(['school_id', 'owner_id'])
    .execute();

  await db.schema
    .createTable('plan_folders')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('color', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('plan_folders_color_check', inList('color', folderColors))
    .execute();
  await db.schema
    .createIndex('plan_folders_school_id_teacher_id_idx')
    .on('plan_folders')
    .columns(['school_id', 'teacher_id'])
    .execute();

  await db.schema
    .createTable('plan_templates')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('title', 'text')
    .addColumn('body', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('plan_templates_kind_check', inList('kind', lessonPlanKinds))
    .execute();
  await db.schema
    .createIndex('plan_templates_school_id_teacher_id_idx')
    .on('plan_templates')
    .columns(['school_id', 'teacher_id'])
    .execute();

  // Plans so far held only a start date, days and codes; nothing outside development has any.
  await db.schema.alterTable('lesson_plans').addColumn('body', 'jsonb').execute();
  await sql`
    UPDATE lesson_plans SET body = CASE kind
      WHEN 'weekly' THEN jsonb_build_object(
        'kind', 'weekly', 'unit', null, 'story', null, 'teacherName', null,
        'subjectIntegration', '[]'::jsonb,
        'weeks', jsonb_build_array(jsonb_build_object(
          'weekStart', to_char(week_start, 'YYYY-MM-DD'), 'objective', null,
          'skills', '[]'::jsonb, 'standards', '[]'::jsonb, 'expectations', null,
          'days', (SELECT jsonb_agg(jsonb_build_object(
            'theme', null, 'dok', '[]'::jsonb, 'eca', '[]'::jsonb,
            'activities', '[]'::jsonb, 'materials', '[]'::jsonb, 'notes', null))
            FROM generate_series(1, 5)))))
      ELSE jsonb_build_object(
        'kind', kind, 'subject', null, 'lessonDate', to_char(week_start, 'YYYY-MM-DD'),
        'lessonDateEnd', null, 'topic', null, 'learningObjectives', null, 'materials', null,
        'hook', null, 'learningGoal', null, 'closure', null, 'testQuizDate', null, 'notes', null)
    END
  `.execute(db);
  await db.schema
    .alterTable('lesson_plans')
    .alterColumn('body', (c) => c.setNotNull())
    .dropColumn('week_start')
    .dropColumn('days')
    .dropColumn('standards')
    .execute();
  await sql`UPDATE lesson_plans SET folder_id = NULL`.execute(db);
  await db.schema
    .alterTable('lesson_plans')
    .addForeignKeyConstraint('lesson_plans_folder_id_fkey', ['folder_id'], 'plan_folders', ['id'])
    .onDelete('set null')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('lesson_plans')
    .dropConstraint('lesson_plans_folder_id_fkey')
    .execute();
  await db.schema
    .alterTable('lesson_plans')
    .addColumn('week_start', 'date', (c) => c.notNull().defaultTo(sql`current_date`))
    .addColumn('days', 'jsonb', (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('standards', 'jsonb', (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .dropColumn('body')
    .execute();
  await db.schema.dropTable('plan_templates').execute();
  await db.schema.dropTable('plan_folders').execute();
  await db.schema.dropTable('jobs').execute();
}
