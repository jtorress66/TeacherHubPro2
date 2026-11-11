import type { Kysely } from 'kysely';

/** Teachers' Canva access: one encrypted refresh token each, replaced at every use. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('canva_connections')
    .addColumn('teacher_id', 'text', (c) =>
      c.primaryKey().references('users.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('encrypted_refresh_token', 'text', (c) => c.notNull())
    .addColumn('connected_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('canva_connections').execute();
}
