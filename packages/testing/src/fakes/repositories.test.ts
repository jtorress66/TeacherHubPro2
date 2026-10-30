import type {
  AssignmentId,
  AttendanceSessionId,
  ClassId,
  GameId,
  GradeCategoryId,
  GradeId,
  SchoolId,
  SemesterId,
  StudentId,
  SubmissionId,
  SubscriptionId,
  UserId,
} from '@thp/domain';
import {
  classRepositoryContract,
  semesterRepositoryContract,
  studentRepositoryContract,
} from '../contracts/roster.contract.ts';
import {
  deletableContract,
  scopedRepositoryContract,
} from '../contracts/scoped-repository.contract.ts';
import {
  attendanceLookupContract,
  gradeRepositoryContract,
  schoolRepositoryContract,
  subscriptionLookupContract,
  userLookupContract,
} from '../contracts/repository-lookups.contract.ts';
import {
  assignmentLookupContract,
  gradebookGradeContract,
  reportCardCommentContract,
} from '../contracts/gradebook.contract.ts';
import { plannerRepositoryContract } from '../contracts/planner.contract.ts';
import {
  aClass,
  aGame,
  aGrade,
  aGradeCategory,
  anAssignment,
  anAttendanceSession,
  aSemester,
  aStudent,
  aSubmission,
  aSubscription,
  aUser,
} from '../fixtures.ts';
import {
  InMemoryAssignmentRepository,
  InMemoryAttendanceSessionRepository,
  InMemoryClassRepository,
  InMemoryGameRepository,
  InMemoryGradeCategoryRepository,
  InMemoryGradeRepository,
  InMemoryLessonPlanRepository,
  InMemoryPlanFolderRepository,
  InMemoryPlanTemplateRepository,
  InMemoryReportCardCommentRepository,
  InMemorySchoolRepository,
  InMemorySemesterRepository,
  InMemoryStudentRepository,
  InMemorySubmissionRepository,
  InMemorySubscriptionRepository,
  InMemoryUserRepository,
} from './repositories.ts';

schoolRepositoryContract('InMemorySchoolRepository', () => new InMemorySchoolRepository());

scopedRepositoryContract('InMemoryUserRepository', {
  make: () => new InMemoryUserRepository(),
  sample: (schoolId, id) => aUser({ schoolId, id: id as UserId, email: `${id}@mail.com` }),
  change: (user) => ({ ...user, name: 'Changed' }),
  lists: [{ name: 'listBySchool', call: (repo, schoolId) => repo.listBySchool(schoolId) }],
});
userLookupContract('InMemoryUserRepository', () => new InMemoryUserRepository());

const classes = {
  make: () => new InMemoryClassRepository(),
  sample: (schoolId: SchoolId, id: string) => aClass({ schoolId, id: id as ClassId }),
};
scopedRepositoryContract('InMemoryClassRepository', {
  ...classes,
  change: (cls) => ({ ...cls, name: 'Changed' }),
  lists: [
    {
      name: 'listByTeacher',
      call: (repo, schoolId, cls) => repo.listByTeacher(schoolId, cls.teacherId),
    },
  ],
});
deletableContract('InMemoryClassRepository', classes);

const students = {
  make: () => new InMemoryStudentRepository(),
  sample: (schoolId: SchoolId, id: string) => aStudent({ schoolId, id: id as StudentId }),
};
scopedRepositoryContract('InMemoryStudentRepository', {
  ...students,
  change: (student) => ({ ...student, firstName: 'Changed' }),
  lists: [
    {
      name: 'listByClass',
      call: (repo, schoolId, student) => repo.listByClass(schoolId, student.classId),
    },
  ],
});
deletableContract('InMemoryStudentRepository', students);

const semesters = {
  make: () => new InMemorySemesterRepository(),
  sample: (schoolId: SchoolId, id: string) => aSemester({ schoolId, id: id as SemesterId }),
};
deletableContract('InMemorySemesterRepository', semesters);
scopedRepositoryContract('InMemorySemesterRepository', {
  ...semesters,
  change: (semester) => ({ ...semester, isActive: true }),
  lists: [{ name: 'listBySchool', call: (repo, schoolId) => repo.listBySchool(schoolId) }],
});

plannerRepositoryContract('InMemory', () => ({
  plans: new InMemoryLessonPlanRepository(),
  folders: new InMemoryPlanFolderRepository(),
  templates: new InMemoryPlanTemplateRepository(),
}));

const categories = {
  make: () => new InMemoryGradeCategoryRepository(),
  sample: (schoolId: SchoolId, id: string) =>
    aGradeCategory({ schoolId, id: id as GradeCategoryId }),
};
scopedRepositoryContract('InMemoryGradeCategoryRepository', {
  ...categories,
  change: (category) => ({ ...category, weightPercent: 40 }),
  lists: [
    { name: 'listByClass', call: (repo, schoolId, c) => repo.listByClass(schoolId, c.classId) },
  ],
});
deletableContract('InMemoryGradeCategoryRepository', categories);

const assignments = {
  make: () => new InMemoryAssignmentRepository(),
  sample: (schoolId: SchoolId, id: string) => anAssignment({ schoolId, id: id as AssignmentId }),
};
scopedRepositoryContract('InMemoryAssignmentRepository', {
  ...assignments,
  change: (assignment) => ({ ...assignment, title: 'Changed' }),
  lists: [
    { name: 'listByClass', call: (repo, schoolId, a) => repo.listByClass(schoolId, a.classId) },
  ],
});
deletableContract('InMemoryAssignmentRepository', assignments);
assignmentLookupContract('InMemoryAssignmentRepository', () => new InMemoryAssignmentRepository());

scopedRepositoryContract('InMemoryGradeRepository', {
  make: () => new InMemoryGradeRepository(),
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
gradeRepositoryContract('InMemoryGradeRepository', () => new InMemoryGradeRepository());
gradebookGradeContract('InMemoryGradeRepository', () => new InMemoryGradeRepository());
reportCardCommentContract(
  'InMemoryReportCardCommentRepository',
  () => new InMemoryReportCardCommentRepository(),
);

scopedRepositoryContract('InMemorySubmissionRepository', {
  make: () => new InMemorySubmissionRepository(),
  sample: (schoolId, id) => aSubmission({ schoolId, id: id as SubmissionId }),
  change: (submission) => ({ ...submission, aiFailure: 'timeout' }),
  lists: [
    {
      name: 'listByAssignment',
      call: (repo, schoolId, s) => repo.listByAssignment(schoolId, s.assignmentId),
    },
  ],
});

scopedRepositoryContract('InMemoryAttendanceSessionRepository', {
  make: () => new InMemoryAttendanceSessionRepository(),
  sample: (schoolId, id) => anAttendanceSession({ schoolId, id: id as AttendanceSessionId }),
  change: (session) => ({ ...session, status: 'submitted' as const }),
  lists: [
    { name: 'listByClass', call: (repo, schoolId, s) => repo.listByClass(schoolId, s.classId) },
  ],
});
attendanceLookupContract(
  'InMemoryAttendanceSessionRepository',
  () => new InMemoryAttendanceSessionRepository(),
);

const games = {
  make: () => new InMemoryGameRepository(),
  sample: (schoolId: SchoolId, id: string) => aGame({ schoolId, id: id as GameId }),
};
scopedRepositoryContract('InMemoryGameRepository', {
  ...games,
  change: (game) => ({ ...game, title: 'Changed' }),
  lists: [
    {
      name: 'listByTeacher',
      call: (repo, schoolId, g) => repo.listByTeacher(schoolId, g.teacherId),
    },
  ],
});
deletableContract('InMemoryGameRepository', games);

scopedRepositoryContract('InMemorySubscriptionRepository', {
  make: () => new InMemorySubscriptionRepository(),
  sample: (schoolId, id) => aSubscription({ schoolId, id: id as SubscriptionId }),
  change: (subscription) => ({ ...subscription, status: 'canceled' as const }),
  lists: [{ name: 'listBySchool', call: (repo, schoolId) => repo.listBySchool(schoolId) }],
});
subscriptionLookupContract(
  'InMemorySubscriptionRepository',
  () => new InMemorySubscriptionRepository(),
);

classRepositoryContract('InMemoryClassRepository', () => new InMemoryClassRepository());
studentRepositoryContract('InMemoryStudentRepository', () => new InMemoryStudentRepository());
semesterRepositoryContract('InMemorySemesterRepository', () => new InMemorySemesterRepository());
