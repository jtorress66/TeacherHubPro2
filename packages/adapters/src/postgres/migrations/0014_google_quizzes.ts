import type { Kysely } from 'kysely';

/** Google Forms quizzes teachers made from a PDF without a class: only their links. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('google_quizzes')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('owner_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('form_id', 'text', (c) => c.notNull())
    .addColumn('edit_url', 'text', (c) => c.notNull())
    .addColumn('responder_url', 'text', (c) => c.notNull())
    .addColumn('made_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('google_quizzes_owner_idx')
    .on('google_quizzes')
    .columns(['school_id', 'owner_id', 'made_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('google_quizzes').execute();
}
