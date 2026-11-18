import type { Kysely } from 'kysely';

/** Sign-in tickets already used, kept until they expire, so each works only once. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('used_tickets')
    .addColumn('ticket_id', 'text', (c) => c.primaryKey())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('used_tickets').execute();
}
