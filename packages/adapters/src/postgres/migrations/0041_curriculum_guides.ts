import { sql, type Kysely } from 'kysely';

/** Each school's own curriculum guides, at most one per subject and grade. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('curriculum_guides')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id').onDelete('cascade'))
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('grade', 'text', (c) => c.notNull())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('source_name', 'text')
    .addColumn('status', 'text', (c) =>
      c.notNull().check(sql`status IN ('reading', 'ready', 'failed')`),
    )
    .addColumn('failure', 'text')
    .addColumn('job_id', 'text')
    .addColumn('text', 'text', (c) => c.notNull())
    .addColumn('total_characters', 'integer', (c) => c.notNull())
    .addColumn('updated_by', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
    .addUniqueConstraint('curriculum_guides_subject_grade', ['school_id', 'subject', 'grade'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('curriculum_guides').execute();
}
