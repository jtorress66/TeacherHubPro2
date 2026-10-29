import { sql, type Kysely } from 'kysely';

/** Sign-in: sessions (only token hashes) and password hashes, kept apart from users. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('sessions')
    .addColumn('token_hash', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addCheckConstraint('sessions_expiry_check', sql`expires_at > created_at`)
    .execute();
  await db.schema.createIndex('sessions_user_id_idx').on('sessions').column('user_id').execute();

  await db.schema
    .createTable('password_credentials')
    .addColumn('user_id', 'text', (c) => c.primaryKey().references('users.id').onDelete('cascade'))
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('password_credentials').execute();
  await db.schema.dropTable('sessions').execute();
}
