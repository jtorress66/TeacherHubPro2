import type { Kysely } from 'kysely';

/** Teachers' calendar subscription links: one each, stored only as a hash of the secret. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('calendar_feeds')
    .addColumn('teacher_id', 'text', (c) =>
      c.primaryKey().references('users.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('calendar_feeds').execute();
}
