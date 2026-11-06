import { sql, type Kysely } from 'kysely';
import { defaultPlanFormat, planFormats } from '@thp/domain';

/** How each school's weekly plans print; every school starts with the classic format. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('schools')
    .addColumn('plan_format', 'text', (c) => c.notNull().defaultTo(defaultPlanFormat))
    .execute();
  await db.schema
    .alterTable('schools')
    .addCheckConstraint(
      'schools_plan_format_check',
      sql`plan_format in (${sql.join(planFormats.map((format) => sql.lit(format)))})`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('schools').dropColumn('plan_format').execute();
}
