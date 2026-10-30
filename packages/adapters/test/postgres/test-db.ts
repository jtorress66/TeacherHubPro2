import { sql, type Kysely } from 'kysely';
import { inject } from 'vitest';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  SchoolId,
  SemesterId,
  StudentId,
  UserId,
} from '@thp/domain';
import {
  aClass,
  aGradeCategory,
  anAssignment,
  aSchool,
  aSemester,
  aStudent,
  aUser,
} from '@thp/testing';
import { createDatabase, type Database } from '../../src/postgres/index.ts';
import {
  assignmentMapper,
  gradeCategoryMapper,
} from '../../src/postgres/mappers/gradebook-mappers.ts';
import {
  classMapper,
  schoolMapper,
  semesterMapper,
  studentMapper,
  userMapper,
} from '../../src/postgres/mappers/school-mappers.ts';

export const connect = (): Kysely<Database> => createDatabase(inject('databaseUrl'));

const tables = [
  'jobs',
  'plan_templates',
  'stored_files',
  'report_card_comments',
  'sessions',
  'password_credentials',
  'attendance_entries',
  'attendance_sessions',
  'submissions',
  'grades',
  'assignments',
  'grade_categories',
  'lesson_plans',
  'plan_folders',
  'games',
  'subscriptions',
  'students',
  'classes',
  'semesters',
  'users',
  'schools',
] as const;

export const truncateAll = async (db: Kysely<Database>): Promise<void> => {
  await sql`TRUNCATE ${sql.join(tables.map((t) => sql.table(t)))} CASCADE`.execute(db);
};

export const schoolA = 'school-a' as SchoolId;
export const schoolB = 'school-b' as SchoolId;

/**
 * Parent rows that the shared contract fixtures reference, so foreign keys stay enforced.
 * Each repository's tests seed only the parents it needs, never rows of its own table.
 */
const seeds = {
  schools: (db: Kysely<Database>) =>
    db
      .insertInto('schools')
      .values([schoolA, schoolB].map((id) => schoolMapper.toRow(aSchool({ id }))))
      .execute(),
  teacher: (db: Kysely<Database>) =>
    db
      .insertInto('users')
      .values(userMapper.toRow(aUser({ id: 'teacher-1' as UserId, schoolId: schoolA })))
      .execute(),
  secondTeacher: (db: Kysely<Database>) =>
    db
      .insertInto('users')
      .values(
        userMapper.toRow(
          aUser({ id: 'teacher-2' as UserId, schoolId: schoolA, email: 'ben@school.edu' }),
        ),
      )
      .execute(),
  class: (db: Kysely<Database>) =>
    db
      .insertInto('classes')
      .values(classMapper.toRow(aClass({ id: 'class-1' as ClassId, schoolId: schoolA })))
      .execute(),
  semester: (db: Kysely<Database>) =>
    db
      .insertInto('semesters')
      .values(
        semesterMapper.toRow(aSemester({ id: 'semester-1' as SemesterId, schoolId: schoolA })),
      )
      .execute(),
  secondClass: (db: Kysely<Database>) =>
    db
      .insertInto('classes')
      .values(classMapper.toRow(aClass({ id: 'class-2' as ClassId, schoolId: schoolA })))
      .execute(),
  category: (db: Kysely<Database>) =>
    db
      .insertInto('grade_categories')
      .values(
        gradeCategoryMapper.toRow(
          aGradeCategory({ id: 'category-1' as GradeCategoryId, schoolId: schoolA }),
        ),
      )
      .execute(),
  students: (db: Kysely<Database>) =>
    db
      .insertInto('students')
      .values(
        ['student-1', 'student-one', 'student-two'].map((id) =>
          studentMapper.toRow(aStudent({ id: id as StudentId, schoolId: schoolA })),
        ),
      )
      .execute(),
  assignments: (db: Kysely<Database>) =>
    db
      .insertInto('assignments')
      .values(
        ['assignment-1', 'a1'].map((id) =>
          assignmentMapper.toRow(anAssignment({ id: id as AssignmentId, schoolId: schoolA })),
        ),
      )
      .execute(),
};

export type Parent = keyof typeof seeds;

/** The parents each level of the ownership chain needs, in insert order. */
export const parentsFor = {
  none: [],
  school: ['schools'],
  teacher: ['schools', 'teacher'],
  accounts: ['schools', 'teacher', 'secondTeacher'],
  classes: ['schools', 'teacher', 'secondTeacher', 'semester'],
  rosters: ['schools', 'teacher', 'class', 'secondClass'],
  class: ['schools', 'teacher', 'class'],
  category: ['schools', 'teacher', 'class', 'category'],
  roster: ['schools', 'teacher', 'class', 'students'],
  attendance: ['schools', 'teacher', 'class', 'secondClass', 'students'],
  grading: ['schools', 'teacher', 'class', 'category', 'students', 'assignments'],
} as const satisfies Record<string, readonly Parent[]>;

/** A clean database with the given parents, for one test. */
export async function resetWith(db: Kysely<Database>, parents: readonly Parent[]): Promise<void> {
  await truncateAll(db);
  for (const parent of parents) await seeds[parent](db);
}
