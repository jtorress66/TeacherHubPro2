import { sql, type Kysely } from 'kysely';

/**
 * One sign-in per account: each session records when it was last used and a coarse device (browser
 * and system keys, never the user agent or an address), and a session ended by a sign-in elsewhere
 * is kept, with when and why, so its browser can be told. Existing sessions keep working with no
 * device, and count as seen at the upgrade, so anyone at work then is warned before being replaced.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('sessions')
    .addColumn('last_seen_at', 'timestamptz')
    .addColumn('device_browser', 'text')
    .addColumn('device_os', 'text')
    .addColumn('ended_at', 'timestamptz')
    .addColumn('ended_reason', 'text')
    .execute();
  await sql`UPDATE sessions SET last_seen_at = now()`.execute(db);
  await db.schema
    .alterTable('sessions')
    .alterColumn('last_seen_at', (c) => c.setNotNull())
    .execute();
  await db.schema
    .alterTable('sessions')
    .alterColumn('last_seen_at', (c) => c.setDefault(sql`now()`))
    .execute();
  await db.schema
    .alterTable('sessions')
    .addCheckConstraint('sessions_ended_check', sql`(ended_at IS NULL) = (ended_reason IS NULL)`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sessions').dropConstraint('sessions_ended_check').execute();
  await db.schema
    .alterTable('sessions')
    .dropColumn('ended_reason')
    .dropColumn('ended_at')
    .dropColumn('device_os')
    .dropColumn('device_browser')
    .dropColumn('last_seen_at')
    .execute();
}
