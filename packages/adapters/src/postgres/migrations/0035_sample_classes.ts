import type { Kysely } from 'kysely';

/** Marks the made-up class a new teacher starts with, so it can be labelled and removed. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('classes')
    .addColumn('sample', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('classes').dropColumn('sample').execute();
}
