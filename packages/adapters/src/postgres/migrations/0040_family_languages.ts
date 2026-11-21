import type { Kysely } from 'kysely';

/** The language each student's family reads, and the parent email's translations on a batch. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('students').addColumn('family_language', 'text').execute();
  await db.schema.alterTable('prep_batches').addColumn('email_translations', 'jsonb').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('prep_batches').dropColumn('email_translations').execute();
  await db.schema.alterTable('students').dropColumn('family_language').execute();
}
