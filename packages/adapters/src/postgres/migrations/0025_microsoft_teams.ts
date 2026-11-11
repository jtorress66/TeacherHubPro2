import type { Kysely } from 'kysely';

/**
 * Whether each teacher's Microsoft connection also allows Teams (school accounts only); earlier
 * connections are OneDrive only.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('microsoft_connections')
    .addColumn('teams', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('microsoft_connections').dropColumn('teams').execute();
}
