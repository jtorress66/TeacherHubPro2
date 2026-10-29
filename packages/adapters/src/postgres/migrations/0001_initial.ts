import { sql, type Kysely, type RawBuilder } from 'kysely';
import {
  attendanceStatuses,
  gradeSources,
  gradeStatuses,
  languages,
  lessonPlanKinds,
  onboardingStatuses,
  planIds,
  roles,
  sessionStatuses,
  submissionStatuses,
  subscriptionStatuses,
} from '@thp/domain';

/** `column IN ('a', 'b', …)` from a domain list, so the database and the domain never disagree. */
const inList = (column: string, values: readonly string[]): RawBuilder<boolean> =>
  sql<boolean>`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`;

const hhmm = (column: string): RawBuilder<boolean> =>
  sql<boolean>`${sql.ref(column)} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`;

const createdAt = sql`now()`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('schools')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('address', 'text')
    .addColumn('phone', 'text')
    .addColumn('email', 'text')
    .addColumn('logo_url', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .execute();

  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('language', 'text', (c) => c.notNull())
    .addColumn('picture', 'text')
    .addColumn('onboarding_status', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('users_role_check', inList('role', roles))
    .addCheckConstraint('users_language_check', inList('language', languages))
    .addCheckConstraint(
      'users_onboarding_status_check',
      inList('onboarding_status', onboardingStatuses),
    )
    .execute();

  await db.schema
    .createTable('semesters')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('start_date', 'date', (c) => c.notNull())
    .addColumn('end_date', 'date', (c) => c.notNull())
    .addColumn('school_year', 'text')
    .addColumn('is_active', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('semesters_dates_check', sql`end_date >= start_date`)
    .execute();
  await sql`CREATE UNIQUE INDEX semesters_one_active_per_school ON semesters (school_id) WHERE is_active`.execute(
    db,
  );

  await db.schema
    .createTable('classes')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('subject', 'text')
    .addColumn('grade', 'text')
    .addColumn('section', 'text')
    .addColumn('school_year', 'text')
    .addColumn('semester_id', 'text', (c) => c.references('semesters.id'))
    .addColumn('schedule_days', 'jsonb')
    .addColumn('period', 'integer')
    .addColumn('start_time', 'text')
    .addColumn('end_time', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('classes_period_check', sql`period BETWEEN 1 AND 12`)
    .addCheckConstraint('classes_start_time_format', hhmm('start_time'))
    .addCheckConstraint('classes_end_time_format', hhmm('end_time'))
    .addCheckConstraint(
      'classes_times_check',
      sql`(start_time IS NULL) = (end_time IS NULL) AND (start_time IS NULL OR start_time < end_time)`,
    )
    .addCheckConstraint(
      'classes_schedule_check',
      sql`schedule_days IS NOT NULL OR (period IS NULL AND start_time IS NULL)`,
    )
    .execute();

  await db.schema
    .createTable('students')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id'))
    .addColumn('first_name', 'text', (c) => c.notNull())
    .addColumn('last_name', 'text', (c) => c.notNull())
    .addColumn('student_number', 'text')
    .addColumn('parent_email', 'text')
    .addColumn('accommodations', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .execute();

  await db.schema
    .createTable('lesson_plans')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('title', 'text')
    .addColumn('week_start', 'date', (c) => c.notNull())
    .addColumn('class_id', 'text', (c) => c.references('classes.id'))
    // Plan folders arrive in step 8, with their table and this foreign key.
    .addColumn('folder_id', 'text')
    .addColumn('days', 'jsonb', (c) => c.notNull())
    .addColumn('standards', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('lesson_plans_kind_check', inList('kind', lessonPlanKinds))
    .addCheckConstraint(
      'lesson_plans_conversational_has_title',
      sql`kind <> 'conversational_english' OR title IS NOT NULL`,
    )
    .execute();

  await db.schema
    .createTable('grade_categories')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('weight_percent', 'double precision', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint(
      'grade_categories_weight_percent_check',
      sql`weight_percent BETWEEN 0 AND 100`,
    )
    .execute();

  await db.schema
    .createTable('assignments')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id'))
    .addColumn('category_id', 'text', (c) => c.notNull().references('grade_categories.id'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('points', 'double precision', (c) => c.notNull())
    .addColumn('due_date', 'date')
    .addColumn('questions', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('assignments_points_check', sql`points > 0`)
    .execute();

  await db.schema
    .createTable('grades')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('student_id', 'text', (c) => c.notNull().references('students.id'))
    .addColumn('assignment_id', 'text', (c) => c.notNull().references('assignments.id'))
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('score', 'double precision')
    .addColumn('source', 'text', (c) => c.notNull())
    .addColumn('graded_by', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('comment', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addUniqueConstraint('grades_student_assignment_key', ['student_id', 'assignment_id'])
    .addCheckConstraint('grades_status_check', inList('status', gradeStatuses))
    .addCheckConstraint('grades_source_check', inList('source', gradeSources))
    .addCheckConstraint('grades_score_check', sql`score >= 0`)
    .addCheckConstraint(
      'grades_score_matches_status',
      sql`(status IN ('graded', 'late')) = (score IS NOT NULL)`,
    )
    .execute();

  await db.schema
    .createTable('submissions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('assignment_id', 'text', (c) => c.notNull().references('assignments.id'))
    .addColumn('student_id', 'text', (c) => c.notNull().references('students.id'))
    .addColumn('answers', 'jsonb', (c) => c.notNull())
    .addColumn('submitted_at', 'timestamptz', (c) => c.notNull())
    .addColumn('max_points', 'double precision', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('ai_draft', 'jsonb')
    .addColumn('ai_failure', 'text')
    .addColumn('final_score', 'double precision')
    .addColumn('confirmed_by', 'text', (c) => c.references('users.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('submissions_status_check', inList('status', submissionStatuses))
    .addCheckConstraint('submissions_max_points_check', sql`max_points > 0`)
    .addCheckConstraint(
      'submissions_final_score_check',
      sql`final_score >= 0 AND final_score <= max_points`,
    )
    .addCheckConstraint(
      'submissions_confirmed_has_decision',
      sql`status <> 'confirmed' OR (final_score IS NOT NULL AND confirmed_by IS NOT NULL)`,
    )
    .addCheckConstraint(
      'submissions_ai_graded_has_draft',
      sql`status <> 'ai_graded' OR ai_draft IS NOT NULL`,
    )
    .execute();

  await db.schema
    .createTable('attendance_sessions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id'))
    .addColumn('date', 'date', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addUniqueConstraint('attendance_sessions_class_date_key', ['school_id', 'class_id', 'date'])
    .addCheckConstraint('attendance_sessions_status_check', inList('status', sessionStatuses))
    .execute();

  await db.schema
    .createTable('attendance_entries')
    .addColumn('session_id', 'text', (c) =>
      c.notNull().references('attendance_sessions.id').onDelete('cascade'),
    )
    .addColumn('student_id', 'text', (c) => c.notNull().references('students.id'))
    .addColumn('position', 'integer', (c) => c.notNull())
    .addColumn('status', 'text')
    .addPrimaryKeyConstraint('attendance_entries_pkey', ['session_id', 'student_id'])
    .addUniqueConstraint('attendance_entries_position_key', ['session_id', 'position'])
    .addCheckConstraint('attendance_entries_status_check', inList('status', attendanceStatuses))
    .execute();

  await db.schema
    .createTable('games')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('mode_id', 'text', (c) => c.notNull())
    .addColumn('language', 'text', (c) => c.notNull())
    .addColumn('items', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('games_language_check', inList('language', languages))
    .execute();

  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('owner_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('plan_id', 'text', (c) => c.notNull())
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('trial_ends_at', 'timestamptz', (c) => c.notNull())
    .addColumn('current_period_end', 'timestamptz')
    .addColumn('external_id', 'text', (c) => c.unique())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(createdAt))
    .addCheckConstraint('subscriptions_plan_id_check', inList('plan_id', planIds))
    .addCheckConstraint('subscriptions_status_check', inList('status', subscriptionStatuses))
    .addCheckConstraint('subscriptions_quantity_check', sql`quantity >= 1`)
    .execute();

  const indexes: readonly [table: string, columns: readonly string[]][] = [
    ['users', ['school_id']],
    ['semesters', ['school_id']],
    ['classes', ['school_id', 'teacher_id']],
    ['students', ['school_id', 'class_id']],
    ['lesson_plans', ['school_id', 'teacher_id']],
    ['grade_categories', ['school_id', 'class_id']],
    ['assignments', ['school_id', 'class_id']],
    ['grades', ['school_id', 'student_id']],
    ['grades', ['school_id', 'assignment_id']],
    ['submissions', ['school_id', 'assignment_id']],
    ['attendance_sessions', ['school_id', 'class_id']],
    ['games', ['school_id', 'teacher_id']],
    ['subscriptions', ['school_id']],
  ];
  for (const [table, columns] of indexes) {
    await db.schema
      .createIndex(`${table}_${columns.join('_')}_idx`)
      .on(table)
      .columns([...columns])
      .execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const tables = [
    'attendance_entries',
    'attendance_sessions',
    'submissions',
    'grades',
    'assignments',
    'grade_categories',
    'lesson_plans',
    'games',
    'subscriptions',
    'students',
    'classes',
    'semesters',
    'users',
    'schools',
  ];
  for (const table of tables) await db.schema.dropTable(table).execute();
}
