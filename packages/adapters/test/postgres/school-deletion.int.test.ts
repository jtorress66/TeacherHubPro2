import { sql } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  requestSchoolDeletion,
  type AssignmentId,
  type AttendanceSessionId,
  type AuditEventId,
  type ClassId,
  type GradeCategoryId,
  type GradeId,
  type LessonPlanId,
  type SchoolId,
  type StudentId,
  type SubmissionId,
  type SubscriptionId,
  type UserId,
} from '@thp/domain';
import {
  aClass,
  aGrade,
  aGradeCategory,
  aLessonPlan,
  anAssignment,
  anAttendanceSession,
  aSchool,
  aStudent,
  aSubmission,
  aSubscription,
  aUser,
  schoolDeletionRepositoryContract,
  schoolEraserContract,
} from '@thp/testing';
import { createPostgresRepositories, PostgresFileStore } from '../../src/postgres/index.ts';
import { schoolTables } from '../../src/postgres/repositories/postgres-school-deletions.ts';
import { connect, parentsFor, resetWith, truncateAll } from './test-db.ts';

const db = connect();
const repos = createPostgresRepositories(db);
const files = new PostgresFileStore(db);
afterAll(() => db.destroy());

/** A school with a teacher, a class, a student and their work, every ID marked with the school. */
async function seed(schoolId: SchoolId): Promise<void> {
  const id = (name: string) => `${name}-${schoolId}`;
  const teacherId = id('teacher') as UserId;
  const classId = id('class') as ClassId;
  const studentId = id('student') as StudentId;
  const assignmentId = id('assignment') as AssignmentId;
  const categoryId = id('category') as GradeCategoryId;
  await repos.schools.save(aSchool({ id: schoolId }));
  await repos.users.save(aUser({ id: teacherId, schoolId, email: `t@${schoolId}.edu` }));
  await repos.subscriptions.save(
    aSubscription({ id: id('sub') as SubscriptionId, schoolId, ownerId: teacherId }),
  );
  await repos.classes.save(aClass({ id: classId, schoolId, teacherId }));
  await repos.students.save(aStudent({ id: studentId, schoolId, classId }));
  await repos.gradeCategories.save(aGradeCategory({ id: categoryId, schoolId, classId }));
  await repos.assignments.save(anAssignment({ id: assignmentId, schoolId, classId, categoryId }));
  await repos.grades.save(
    aGrade({ id: id('grade') as GradeId, schoolId, studentId, assignmentId, gradedBy: teacherId }),
  );
  await repos.submissions.save(
    aSubmission({ id: id('submission') as SubmissionId, schoolId, assignmentId, studentId }),
  );
  await repos.attendanceSessions.save(
    anAttendanceSession({
      id: id('attendance') as AttendanceSessionId,
      schoolId,
      classId,
      roster: [studentId],
    }),
  );
  await repos.lessonPlans.save(
    aLessonPlan({ id: id('plan') as LessonPlanId, schoolId, teacherId }),
  );
  await repos.auditLog.record({
    id: id('event') as AuditEventId,
    schoolId,
    actorId: teacherId,
    action: 'school_data_exported',
    targetId: null,
    at: new Date('2026-11-01T00:00:00Z'),
    review: null,
    count: null,
    classId: null,
  });
  const file = { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' };
  await files.put(`schools/${schoolId}/logo`, file);
  await files.put(`attachments/${schoolId}/${assignmentId}/a1`, file);
}

const count = async (table: string, column: string, value: string): Promise<number> => {
  const { rows } = await sql<{ n: string }>`
    SELECT count(*) AS n FROM ${sql.table(table)} WHERE ${sql.ref(column)} = ${value}`.execute(db);
  return Number(rows[0]?.n ?? 0);
};

/** True when any table, file or the school row still holds something of this school. */
async function hasData(schoolId: SchoolId): Promise<boolean> {
  const counts = await Promise.all([
    count('schools', 'id', schoolId),
    ...schoolTables.map((table) => count(table, 'school_id', schoolId)),
    count('attendance_entries', 'student_id', `student-${schoolId}`),
    count('stored_files', 'key', `schools/${schoolId}/logo`),
    count('stored_files', 'key', `attachments/${schoolId}/assignment-${schoolId}/a1`),
  ]);
  return counts.some((n) => n > 0);
}

describe('with schools', () => {
  beforeEach(() => resetWith(db, parentsFor.teacher));
  schoolDeletionRepositoryContract('PostgresSchoolDeletionRepository', () => repos.schoolDeletions);
});

describe('erasing a school', () => {
  beforeEach(() => truncateAll(db));

  schoolEraserContract('PostgresSchoolEraser', () =>
    Promise.resolve({
      eraser: repos.schoolEraser,
      deletions: repos.schoolDeletions,
      seed,
      hasData,
    }),
  );

  it('knows every table that has a school_id column', async () => {
    const { rows } = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'school_id'
        AND table_name <> 'school_deletions'`.execute(db);

    expect(rows.map((row) => row.table_name).sort()).toEqual([...schoolTables].sort());
  });

  it('keeps only an ID-only proof of the deletion', async () => {
    const schoolId = 'school-gone' as SchoolId;
    await seed(schoolId);
    const request = requestSchoolDeletion({
      schoolId,
      requestedBy: `teacher-${schoolId}` as UserId,
      now: new Date('2026-11-19T12:00:00Z'),
    });
    const deletedAt = new Date('2026-12-19T12:01:00Z');

    await repos.schoolEraser.erase(request, deletedAt);

    expect(await db.selectFrom('school_deletions').selectAll().execute()).toEqual([
      {
        school_id: schoolId,
        requested_by: request.requestedBy,
        requested_at: request.requestedAt,
        deleted_at: deletedAt,
      },
    ]);
  });
});
