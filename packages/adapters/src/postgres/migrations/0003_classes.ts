import { sql, type Kysely } from 'kysely';

/** Archived classes (kept with their roster) and one student number per class. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('classes').addColumn('archived_at', 'timestamptz').execute();
  await db.schema
    .createIndex('classes_school_id_archived_at_idx')
    .on('classes')
    .columns(['school_id', 'archived_at'])
    .execute();
  await sql`CREATE UNIQUE INDEX students_class_student_number_key ON students (class_id, student_number) WHERE student_number IS NOT NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('students_class_student_number_key').execute();
  await db.schema.dropIndex('classes_school_id_archived_at_idx').execute();
  await db.schema.alterTable('classes').dropColumn('archived_at').execute();
}
