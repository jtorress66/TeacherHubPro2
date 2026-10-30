import {
  createAssignment,
  createClass,
  createGame,
  createGrade,
  createGradeCategory,
  createLessonPlan,
  createSchool,
  createSemester,
  createStudent,
  createSubmission,
  createUser,
  openAttendanceSession,
  writeReportCardComment,
  startTrial,
  type AssignmentInput,
  type AttendanceSessionInput,
  type ClassInput,
  type GameInput,
  type GradeCategoryInput,
  type GradeInput,
  type LessonPlanInput,
  type ReportCardComment,
  type ReportCardCommentInput,
  type SchoolInput,
  type SemesterInput,
  type StudentInput,
  type SubmissionInput,
  type TrialInput,
  type UserInput,
} from '@thp/domain';
import type {
  AssignmentId,
  AttendanceSessionId,
  ClassId,
  GameId,
  GameModeId,
  GradeCategoryId,
  GradeId,
  LessonPlanId,
  ReportCardCommentId,
  SchoolId,
  SemesterId,
  StudentId,
  SubmissionId,
  SubscriptionId,
  UserId,
} from '@thp/domain';
import { unwrap } from './unwrap.ts';

/** Builders for valid entities; pass only the fields a test cares about. */

const schoolId = 'school-1' as SchoolId;
const teacherId = 'teacher-1' as UserId;
const classId = 'class-1' as ClassId;

export const aSchool = (overrides: Partial<SchoolInput> = {}) =>
  unwrap(createSchool({ id: schoolId, name: 'Escuela Luz', ...overrides }));

export const aUser = (overrides: Partial<UserInput> = {}) =>
  unwrap(
    createUser({
      id: teacherId,
      schoolId,
      email: 'teacher@school.edu',
      name: 'Ana López',
      ...overrides,
    }),
  );

export const aClass = (overrides: Partial<ClassInput> = {}) =>
  unwrap(createClass({ id: classId, schoolId, teacherId, name: 'Math 7', ...overrides }));

export const aStudent = (overrides: Partial<StudentInput> = {}) =>
  unwrap(
    createStudent({
      id: 'student-1' as StudentId,
      schoolId,
      classId,
      firstName: 'Ben',
      lastName: 'Ortiz',
      ...overrides,
    }),
  );

export const aSemester = (overrides: Partial<SemesterInput> = {}) =>
  unwrap(
    createSemester({
      id: 'semester-1' as SemesterId,
      schoolId,
      name: 'Fall',
      startDate: '2026-08-15',
      endDate: '2026-12-20',
      ...overrides,
    }),
  );

export const aLessonPlan = (overrides: Partial<LessonPlanInput> = {}) =>
  unwrap(
    createLessonPlan({
      id: 'plan-1' as LessonPlanId,
      schoolId,
      teacherId,
      kind: 'weekly',
      weekStart: '2026-09-07',
      ...overrides,
    }),
  );

export const aGradeCategory = (overrides: Partial<GradeCategoryInput> = {}) =>
  unwrap(
    createGradeCategory({
      id: 'category-1' as GradeCategoryId,
      schoolId,
      classId,
      name: 'Tests',
      ...overrides,
    }),
  );

export const anAssignment = (overrides: Partial<AssignmentInput> = {}) =>
  unwrap(
    createAssignment({
      id: 'assignment-1' as AssignmentId,
      schoolId,
      classId,
      categoryId: 'category-1' as GradeCategoryId,
      title: 'Quiz 1',
      ...overrides,
    }),
  );

export const aGrade = (overrides: Partial<GradeInput> = {}) =>
  unwrap(
    createGrade({
      id: 'grade-1' as GradeId,
      schoolId,
      studentId: 'student-1' as StudentId,
      assignmentId: 'assignment-1' as AssignmentId,
      status: 'graded',
      score: 80,
      maxPoints: 100,
      source: 'manual',
      gradedBy: teacherId,
      ...overrides,
    }),
  );

export const aReportCardComment = (
  overrides: Partial<ReportCardCommentInput> = {},
): ReportCardComment => {
  const comment = unwrap(
    writeReportCardComment({
      id: 'comment-1' as ReportCardCommentId,
      schoolId,
      classId,
      studentId: 'student-1' as StudentId,
      text: 'Works hard and helps others.',
      writtenBy: teacherId,
      ...overrides,
    }),
  );
  if (comment === null) throw new Error('A report card comment fixture needs text');
  return comment;
};

export const aSubmission = (overrides: Partial<SubmissionInput> = {}) =>
  unwrap(
    createSubmission({
      id: 'submission-1' as SubmissionId,
      schoolId,
      assignmentId: 'assignment-1' as AssignmentId,
      studentId: 'student-1' as StudentId,
      answers: {},
      submittedAt: new Date('2026-09-18T14:00:00Z'),
      maxPoints: 100,
      ...overrides,
    }),
  );

export const anAttendanceSession = (overrides: Partial<AttendanceSessionInput> = {}) =>
  unwrap(
    openAttendanceSession({
      id: 'attendance-1' as AttendanceSessionId,
      schoolId,
      classId,
      date: '2026-09-14',
      roster: ['student-1' as StudentId],
      ...overrides,
    }),
  );

export const aGame = (overrides: Partial<GameInput> = {}) =>
  unwrap(
    createGame({
      id: 'game-1' as GameId,
      schoolId,
      teacherId,
      title: 'Planets',
      modeId: 'quiz' as GameModeId,
      items: [{ question: 'Largest planet?', answer: 'Jupiter' }],
      ...overrides,
    }),
  );

export const aSubscription = (overrides: Partial<TrialInput> = {}) =>
  unwrap(
    startTrial({
      id: 'subscription-1' as SubscriptionId,
      schoolId,
      ownerId: teacherId,
      planId: 'individual_monthly',
      now: new Date('2026-09-01T00:00:00Z'),
      ...overrides,
    }),
  );
