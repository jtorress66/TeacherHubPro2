import { afterAll, beforeEach, describe } from 'vitest';
import type {
  AssignmentId,
  AttendanceSessionId,
  ClassId,
  GameId,
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
import {
  aClass,
  aGame,
  aGrade,
  aGradeCategory,
  aLessonPlan,
  anAssignment,
  anAttendanceSession,
  aSemester,
  aStudent,
  aSubmission,
  aSubscription,
  aUser,
  attendanceLookupContract,
  classRepositoryContract,
  deletableContract,
  assignmentLookupContract,
  aReportCardComment,
  fileStoreContract,
  gradebookGradeContract,
  gradeRepositoryContract,
  reportCardCommentContract,
  passwordCredentialRepositoryContract,
  schoolRepositoryContract,
  scopedRepositoryContract,
  semesterRepositoryContract,
  sessionRepositoryContract,
  studentRepositoryContract,
  subscriptionLookupContract,
  userLookupContract,
} from '@thp/testing';
import { createPostgresRepositories, PostgresFileStore } from '../../src/postgres/index.ts';
import { connect, parentsFor, resetWith, type Parent } from './test-db.ts';

const db = connect();
const repos = createPostgresRepositories(db);
afterAll(() => db.destroy());

/** Runs contract suites on a clean database seeded with the parents they reference. */
function withParents(parents: readonly Parent[], register: () => void): void {
  describe(`with parents: ${parents.join(', ') || 'none'}`, () => {
    beforeEach(() => resetWith(db, parents));
    register();
  });
}

withParents(parentsFor.none, () => {
  schoolRepositoryContract('PostgresSchoolRepository', () => repos.schools);
});

withParents(parentsFor.school, () => {
  scopedRepositoryContract('PostgresUserRepository', {
    make: () => repos.users,
    sample: (schoolId, id) => aUser({ schoolId, id: id as UserId, email: `${id}@mail.com` }),
    change: (user) => ({ ...user, name: 'Changed' }),
    lists: [{ name: 'listBySchool', call: (repo, schoolId) => repo.listBySchool(schoolId) }],
  });
  userLookupContract('PostgresUserRepository', () => repos.users);
  semesterRepositoryContract('PostgresSemesterRepository', () => repos.semesters);

  const semesters = {
    make: () => repos.semesters,
    sample: (schoolId: SchoolId, id: string) => aSemester({ schoolId, id: id as SemesterId }),
  };
  deletableContract('PostgresSemesterRepository', semesters);
  scopedRepositoryContract('PostgresSemesterRepository', {
    ...semesters,
    change: (semester) => ({ ...semester, isActive: true }),
    lists: [{ name: 'listBySchool', call: (repo, schoolId) => repo.listBySchool(schoolId) }],
  });
});

withParents(parentsFor.teacher, () => {
  const classes = {
    make: () => repos.classes,
    sample: (schoolId: SchoolId, id: string) => aClass({ schoolId, id: id as ClassId }),
  };
  scopedRepositoryContract('PostgresClassRepository', {
    ...classes,
    change: (cls) => ({ ...cls, name: 'Changed' }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, cls) => repo.listByTeacher(schoolId, cls.teacherId),
      },
    ],
  });
  deletableContract('PostgresClassRepository', classes);

  const plans = {
    make: () => repos.lessonPlans,
    sample: (schoolId: SchoolId, id: string) => aLessonPlan({ schoolId, id: id as LessonPlanId }),
  };
  scopedRepositoryContract('PostgresLessonPlanRepository', {
    ...plans,
    change: (plan) => ({ ...plan, standards: ['CCSS.ELA'] }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, plan) => repo.listByTeacher(schoolId, plan.teacherId),
      },
    ],
  });
  deletableContract('PostgresLessonPlanRepository', plans);

  const games = {
    make: () => repos.games,
    sample: (schoolId: SchoolId, id: string) => aGame({ schoolId, id: id as GameId }),
  };
  scopedRepositoryContract('PostgresGameRepository', {
    ...games,
    change: (game) => ({ ...game, title: 'Changed' }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, g) => repo.listByTeacher(schoolId, g.teacherId),
      },
    ],
  });
  deletableContract('PostgresGameRepository', games);

  scopedRepositoryContract('PostgresSubscriptionRepository', {
    make: () => repos.subscriptions,
    sample: (schoolId, id) => aSubscription({ schoolId, id: id as SubscriptionId }),
    change: (subscription) => ({ ...subscription, status: 'canceled' as const }),
    lists: [{ name: 'listBySchool', call: (repo, schoolId) => repo.listBySchool(schoolId) }],
  });
  subscriptionLookupContract('PostgresSubscriptionRepository', () => repos.subscriptions);
});

withParents(parentsFor.accounts, () => {
  sessionRepositoryContract('PostgresSessionRepository', () => repos.sessions);
  passwordCredentialRepositoryContract(
    'PostgresPasswordCredentialRepository',
    () => repos.credentials,
  );
});

withParents(parentsFor.classes, () => {
  classRepositoryContract('PostgresClassRepository', () => repos.classes);
});

withParents(parentsFor.rosters, () => {
  studentRepositoryContract('PostgresStudentRepository', () => repos.students);
});

withParents(parentsFor.class, () => {
  const students = {
    make: () => repos.students,
    sample: (schoolId: SchoolId, id: string) => aStudent({ schoolId, id: id as StudentId }),
  };
  scopedRepositoryContract('PostgresStudentRepository', {
    ...students,
    change: (student) => ({ ...student, firstName: 'Changed' }),
    lists: [
      { name: 'listByClass', call: (repo, schoolId, s) => repo.listByClass(schoolId, s.classId) },
    ],
  });
  deletableContract('PostgresStudentRepository', students);

  const categories = {
    make: () => repos.gradeCategories,
    sample: (schoolId: SchoolId, id: string) =>
      aGradeCategory({ schoolId, id: id as GradeCategoryId }),
  };
  scopedRepositoryContract('PostgresGradeCategoryRepository', {
    ...categories,
    change: (category) => ({ ...category, weightPercent: 40 }),
    lists: [
      { name: 'listByClass', call: (repo, schoolId, c) => repo.listByClass(schoolId, c.classId) },
    ],
  });
  deletableContract('PostgresGradeCategoryRepository', categories);
});

withParents(parentsFor.category, () => {
  const assignments = {
    make: () => repos.assignments,
    sample: (schoolId: SchoolId, id: string) => anAssignment({ schoolId, id: id as AssignmentId }),
  };
  scopedRepositoryContract('PostgresAssignmentRepository', {
    ...assignments,
    change: (assignment) => ({ ...assignment, title: 'Changed' }),
    lists: [
      { name: 'listByClass', call: (repo, schoolId, a) => repo.listByClass(schoolId, a.classId) },
    ],
  });
  deletableContract('PostgresAssignmentRepository', assignments);
  assignmentLookupContract('PostgresAssignmentRepository', () => repos.assignments);
});

withParents(parentsFor.attendance, () => {
  scopedRepositoryContract('PostgresAttendanceSessionRepository', {
    make: () => repos.attendanceSessions,
    sample: (schoolId, id) => anAttendanceSession({ schoolId, id: id as AttendanceSessionId }),
    change: (session) => ({ ...session, status: 'submitted' as const }),
    lists: [
      { name: 'listByClass', call: (repo, schoolId, s) => repo.listByClass(schoolId, s.classId) },
    ],
  });
  attendanceLookupContract('PostgresAttendanceSessionRepository', () => repos.attendanceSessions);
});

withParents(parentsFor.grading, () => {
  scopedRepositoryContract('PostgresGradeRepository', {
    make: () => repos.grades,
    sample: (schoolId, id) =>
      aGrade({ schoolId, id: id as GradeId, studentId: `student-${id}` as StudentId }),
    change: (grade) => ({ ...grade, score: 99 }),
    lists: [
      {
        name: 'listByStudent',
        call: (repo, schoolId, g) => repo.listByStudent(schoolId, g.studentId),
      },
      {
        name: 'listByAssignment',
        call: (repo, schoolId, g) => repo.listByAssignment(schoolId, g.assignmentId),
      },
    ],
  });
  gradeRepositoryContract('PostgresGradeRepository', () => repos.grades);
  gradebookGradeContract('PostgresGradeRepository', () => repos.grades);

  scopedRepositoryContract('PostgresReportCardCommentRepository', {
    make: () => repos.reportCardComments,
    sample: (schoolId, id) =>
      aReportCardComment({
        schoolId,
        id: id as ReportCardCommentId,
        studentId: `student-${id}` as StudentId,
      }),
    change: (comment) => ({ ...comment, text: 'Changed' }),
    lists: [
      { name: 'listByClass', call: (repo, schoolId, c) => repo.listByClass(schoolId, c.classId) },
    ],
  });
  reportCardCommentContract('PostgresReportCardCommentRepository', () => repos.reportCardComments);

  scopedRepositoryContract('PostgresSubmissionRepository', {
    make: () => repos.submissions,
    sample: (schoolId, id) => aSubmission({ schoolId, id: id as SubmissionId }),
    change: (submission) => ({ ...submission, aiFailure: 'timeout' }),
    lists: [
      {
        name: 'listByAssignment',
        call: (repo, schoolId, s) => repo.listByAssignment(schoolId, s.assignmentId),
      },
    ],
  });
});

withParents(parentsFor.none, () => {
  fileStoreContract('PostgresFileStore', () => new PostgresFileStore(db));
});
