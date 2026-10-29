import { sql, type Kysely } from 'kysely';

/** Minutes late (tardies only, 1–240) and a short note on each attendance mark. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('attendance_entries')
    .addColumn('minutes_late', 'integer')
    .addColumn('note', 'varchar(200)')
    .execute();
  await db.schema
    .alterTable('attendance_entries')
    .addCheckConstraint(
      'attendance_entries_minutes_late_check',
      sql`minutes_late IS NULL OR (minutes_late BETWEEN 1 AND 240 AND status = 'tardy')`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('attendance_entries')
    .dropConstraint('attendance_entries_minutes_late_check')
    .execute();
  await db.schema
    .alterTable('attendance_entries')
    .dropColumn('note')
    .dropColumn('minutes_late')
    .execute();
}
