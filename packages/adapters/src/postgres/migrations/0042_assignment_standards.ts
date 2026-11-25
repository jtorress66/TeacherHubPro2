import { sql, type Kysely } from 'kysely';

/** The standards each assignment tests, as its teacher chose them; none for existing ones. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('assignments')
    .addColumn('standards', 'jsonb', (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('assignments').dropColumn('standards').execute();
}
