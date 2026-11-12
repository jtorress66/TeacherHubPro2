import { sql, type Kysely } from 'kysely';

/**
 * 0026 confirmed some accounts that sign in with a password. Those accounts confirm by email once,
 * as agreed. Only confirmations made while 0026 ran are undone (nothing could confirm before it,
 * and Kysely records 0026 just after it runs); super admins stay confirmed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE users SET email_confirmed_at = NULL
    WHERE role <> 'super_admin'
      AND email_confirmed_at <= (
        SELECT timestamp::timestamptz FROM kysely_migration
        WHERE name = '0026_account_protections'
      )
      AND EXISTS (SELECT 1 FROM password_credentials c WHERE c.user_id = users.id)
  `.execute(db);
}

/** The confirmations cannot be restored, and the schema did not change. */
export function down(): Promise<void> {
  return Promise.resolve();
}
