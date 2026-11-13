import type { Kysely } from 'kysely';

/**
 * LTI class lists: the courses each teacher opened TeacherHubPro from, and which roster student
 * each course system learner is (their course system id only). Removing a course system forgets
 * both; removing a student forgets their link; students themselves stay.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('lti_courses')
    .addColumn('platform_id', 'text', (c) =>
      c.notNull().references('lti_platforms.id').onDelete('cascade'),
    )
    .addColumn('context_id', 'text', (c) => c.notNull())
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('memberships_url', 'text')
    .addColumn('last_launched_at', 'timestamptz', (c) => c.notNull())
    .addPrimaryKeyConstraint('lti_courses_pkey', ['platform_id', 'context_id', 'teacher_id'])
    .execute();
  await db.schema
    .createIndex('lti_courses_school_id_teacher_id_idx')
    .on('lti_courses')
    .columns(['school_id', 'teacher_id'])
    .execute();

  await db.schema
    .createTable('lti_student_links')
    .addColumn('platform_id', 'text', (c) =>
      c.notNull().references('lti_platforms.id').onDelete('cascade'),
    )
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('subject', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('lti_student_links_pkey', ['platform_id', 'student_id'])
    .execute();
  await db.schema
    .createIndex('lti_student_links_student_id_idx')
    .on('lti_student_links')
    .column('student_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('lti_student_links').execute();
  await db.schema.dropTable('lti_courses').execute();
}
