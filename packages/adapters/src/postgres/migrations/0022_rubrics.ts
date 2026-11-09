import { sql, type Kysely } from 'kysely';

/** Teachers' rubrics: a grid of criteria by levels, kept as JSON. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('rubrics')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('subject', 'text')
    .addColumn('grade', 'text')
    .addColumn('levels', 'jsonb', (c) => c.notNull())
    .addColumn('criteria', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex('rubrics_school_id_teacher_id_updated_at_idx')
    .on('rubrics')
    .columns(['school_id', 'teacher_id', 'updated_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('rubrics').execute();
}
