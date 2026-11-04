import { sql, type Kysely, type RawBuilder } from 'kysely';

const inList = (column: string, values: readonly string[]): RawBuilder<boolean> =>
  sql<boolean>`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`;

/** Written out, so this migration means the same thing however the code changes later. */
const statuses = ['draft', 'assigned', 'archived'];

/**
 * Adaptive learning: each student's learning paths (drafted by the AI, reviewed and assigned by
 * the teacher) and every check they submitted.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('learning_paths')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id').onDelete('cascade'))
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('grade', 'text', (c) => c.notNull())
    .addColumn('language', 'text', (c) => c.notNull())
    .addColumn('level', 'integer', (c) => c.notNull())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('description', 'text', (c) => c.notNull())
    .addColumn('lessons', 'jsonb', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('assigned_at', 'timestamptz')
    .addCheckConstraint('learning_paths_status_check', inList('status', statuses))
    .addCheckConstraint('learning_paths_level_check', sql`level between 1 and 5`)
    .addCheckConstraint(
      'learning_paths_assigned_check',
      sql`(status = 'draft') = (assigned_at is null)`,
    )
    .execute();
  await sql`create unique index learning_paths_assigned_key on learning_paths (student_id, subject) where status = 'assigned'`.execute(
    db,
  );
  await db.schema
    .createIndex('learning_paths_student_idx')
    .on('learning_paths')
    .columns(['school_id', 'student_id', 'created_at'])
    .execute();
  await db.schema
    .createIndex('learning_paths_class_idx')
    .on('learning_paths')
    .columns(['school_id', 'class_id', 'created_at'])
    .execute();

  await db.schema
    .createTable('lesson_attempts')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('path_id', 'text', (c) =>
      c.notNull().references('learning_paths.id').onDelete('cascade'),
    )
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('lesson', 'integer', (c) => c.notNull())
    .addColumn('answers', 'jsonb', (c) => c.notNull())
    .addColumn('score', 'integer', (c) => c.notNull())
    .addColumn('total', 'integer', (c) => c.notNull())
    .addColumn('at', 'timestamptz', (c) => c.notNull())
    .addCheckConstraint(
      'lesson_attempts_score_check',
      sql`lesson >= 0 and score >= 0 and total > 0 and score <= total`,
    )
    .execute();
  await db.schema
    .createIndex('lesson_attempts_path_idx')
    .on('lesson_attempts')
    .columns(['school_id', 'path_id', 'at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('lesson_attempts').execute();
  await db.schema.dropTable('learning_paths').execute();
}
