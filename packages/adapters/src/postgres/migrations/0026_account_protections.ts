import { sql, type Kysely } from 'kysely';

/**
 * Account protections: email confirmation (links kept only as hashes), suspension, and email
 * domains that may not sign up.
 *
 * Existing accounts start unconfirmed, except super admins and accounts that have never had a
 * password (they sign in with Google, which verifies the address, or have yet to choose a
 * password from an emailed link, which confirms it).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('email_confirmed_at', 'timestamptz')
    .addColumn('suspended_at', 'timestamptz')
    .execute();
  await sql`
    UPDATE users SET email_confirmed_at = now()
    WHERE role = 'super_admin'
       OR NOT EXISTS (SELECT 1 FROM password_credentials c WHERE c.user_id = users.id)
  `.execute(db);

  await db.schema
    .createTable('email_confirmations')
    .addColumn('token_hash', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('email_confirmations_user_idx')
    .on('email_confirmations')
    .column('user_id')
    .execute();

  await db.schema
    .createTable('blocked_domains')
    .addColumn('domain', 'text', (c) => c.primaryKey())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('created_by', 'text', (c) => c.references('users.id').onDelete('set null'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('blocked_domains').execute();
  await db.schema.dropTable('email_confirmations').execute();
  await db.schema
    .alterTable('users')
    .dropColumn('suspended_at')
    .dropColumn('email_confirmed_at')
    .execute();
}
