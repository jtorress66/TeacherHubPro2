import type { Kysely } from 'kysely';

/** Student 360: teachers' private notes about a student, and the latest AI insight per teacher. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('student_notes')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('author_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('text', 'text', (c) => c.notNull())
    .addColumn('written_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('student_notes_author_idx')
    .on('student_notes')
    .columns(['school_id', 'student_id', 'author_id', 'written_at'])
    .execute();

  await db.schema
    .createTable('student_insights')
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('bullets', 'jsonb', (c) => c.notNull())
    .addColumn('generated_at', 'timestamptz', (c) => c.notNull())
    .addPrimaryKeyConstraint('student_insights_pkey', ['school_id', 'student_id', 'teacher_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('student_insights').execute();
  await db.schema.dropTable('student_notes').execute();
}
