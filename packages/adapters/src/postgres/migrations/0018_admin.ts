import type { Kysely } from 'kysely';

/** Admin: one-time set-password links (welcome and reset), kept only as hashes. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('password_tokens')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id').onDelete('cascade'))
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('purpose', 'text', (c) => c.notNull())
    .addColumn('issued_at', 'timestamptz', (c) => c.notNull())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .execute();
  await db.schema
    .createIndex('password_tokens_user_idx')
    .on('password_tokens')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('password_tokens').execute();
}
