import type { Kysely } from 'kysely';

/** The latest Google Forms quiz made from each assignment, so its links stay at hand. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('forms_exports')
    .addColumn('assignment_id', 'text', (c) =>
      c.primaryKey().references('assignments.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('form_id', 'text', (c) => c.notNull())
    .addColumn('edit_url', 'text', (c) => c.notNull())
    .addColumn('responder_url', 'text', (c) => c.notNull())
    .addColumn('made_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('forms_exports').execute();
}
