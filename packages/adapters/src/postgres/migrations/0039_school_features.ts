import type { Kysely } from 'kysely';

/** The school-wide switches an admin can turn off: AI drafting, and student flags and insights. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('schools')
    .addColumn('ai_enabled', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('student_flags_enabled', 'boolean', (c) => c.notNull().defaultTo(true))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('schools')
    .dropColumn('student_flags_enabled')
    .dropColumn('ai_enabled')
    .execute();
}
