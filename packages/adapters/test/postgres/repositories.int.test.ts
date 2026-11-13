import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  Email,
  AssignmentId,
  AttendanceSessionId,
  ClassId,
  GameId,
  GradeCategoryId,
  GradeId,
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
  jobQueueContract,
  plannerRepositoryContract,
  assistantRepositoryContract,
  assignmentRepositoryContract,
  canvaConnectionRepositoryContract,
  calendarFeedRepositoryContract,
  ltiRepositoryContract,
  toolKeyStoreContract,
  FakeSecretCipher,
  FixedClock,
  SequentialTokenGenerator,
  microsoftConnectionRepositoryContract,
  student360RepositoryContract,
  prepBatchRepositoryContract,
  adminContract,
  accountProtectionContract,
  marketingContract,
  rateLimiterContract,
  auditLogContract,
  gamePlayRepositoryContract,
  liveRepositoryContract,
  learningRepositoryContract,
  mailerContract,
  portalRepositoryContract,
  SequentialIdGenerator,
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
import {
  createPostgresRepositories,
  PostgresFileStore,
  PostgresJobQueue,
  PostgresToolKeyStore,
} from '../../src/postgres/index.ts';
import { LocalMailer } from '../../src/mail/local-mailer.ts';
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

withParents(parentsFor.assistant, () => {
  assistantRepositoryContract('Postgres', () => ({
    generations: repos.generations,
    presentations: repos.presentations,
    rubrics: repos.rubrics,
    subPackets: repos.subPackets,
  }));
});

withParents(parentsFor.grading, () => {
  assignmentRepositoryContract('Postgres', () => ({
    submissions: repos.submissions,
    attachments: repos.attachments,
    studentLinks: repos.studentLinks,
    classroomConnections: repos.classroomConnections,
    formsExports: repos.formsExports,
  }));
  canvaConnectionRepositoryContract('Postgres', () => repos.canvaConnections);
  microsoftConnectionRepositoryContract('Postgres', () => repos.microsoftConnections);
});

withParents(parentsFor.teacher, () => {
  calendarFeedRepositoryContract('Postgres', () => repos.calendarFeeds);
});

withParents(parentsFor.accounts, () => {
  ltiRepositoryContract('Postgres', () => ({
    platforms: repos.ltiPlatforms,
    nonces: repos.ltiNonces,
    userLinks: repos.ltiUserLinks,
  }));
});

withParents(parentsFor.none, () => {
  toolKeyStoreContract(
    'PostgresToolKeyStore',
    () =>
      new PostgresToolKeyStore(db, {
        cipher: new FakeSecretCipher(),
        tokens: new SequentialTokenGenerator(),
        clock: new FixedClock(new Date('2026-11-12T12:00:00Z')),
      }),
  );
});

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

  plannerRepositoryContract('Postgres', () => ({
    plans: repos.lessonPlans,
    folders: repos.planFolders,
    templates: repos.planTemplates,
  }));
  jobQueueContract(
    'PostgresJobQueue',
    () => new PostgresJobQueue(db, new SequentialIdGenerator('job')),
  );

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

withParents(parentsFor.class, () => {
  const games = {
    make: () => repos.games,
    sample: (schoolId: SchoolId, id: string) =>
      aGame({ schoolId, id: id as GameId, classId: 'class-1' as ClassId }),
  };
  scopedRepositoryContract('PostgresGameRepository', {
    ...games,
    change: (game) => ({ ...game, title: 'Changed' }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, g) => repo.listByTeacher(schoolId, g.teacherId),
      },
      {
        name: 'listByClass',
        call: (repo, schoolId, g) => repo.listByClass(schoolId, g.classId ?? ('none' as ClassId)),
      },
    ],
  });
  deletableContract('PostgresGameRepository', games);
});

withParents(parentsFor.games, () => {
  gamePlayRepositoryContract('Postgres', () => repos.gamePlays);
  liveRepositoryContract('Postgres', () => ({
    sessions: repos.liveSessions,
    players: repos.livePlayers,
    answers: repos.liveAnswers,
  }));
});

withParents(parentsFor.roster, () => {
  learningRepositoryContract('Postgres', () => ({
    paths: repos.learningPaths,
    attempts: repos.lessonAttempts,
  }));
});

withParents(parentsFor.roster, () => {
  portalRepositoryContract('Postgres', () => ({
    portalLinks: repos.portalLinks,
    trialReminders: repos.trialReminders,
    subscriptions: repos.subscriptions,
  }));
});

withParents(parentsFor.none, () => {
  const local = () => new LocalMailer(db);
  mailerContract('LocalMailer', {
    accepting: local,
    // The stand-in refuses addresses on the reserved .invalid domain.
    rejecting: () => ({
      send: (message) => local().send({ ...message, to: 'nobody@school.invalid' as Email }),
    }),
  });

  describe('LocalMailer (development mailbox)', () => {
    it('keeps what it sent, newest first, for the development mail page', async () => {
      let tick = Date.parse('2026-11-04T10:00:00Z');
      const mailer = new LocalMailer(db, { now: () => new Date((tick += 1000)) });
      const message = { to: 'parent@example.com' as Email, html: '<p>Hi</p>', text: 'Hi' };
      await mailer.send({ ...message, subject: 'First' });
      await mailer.send({ ...message, subject: 'Second' });
      const sent = await mailer.list(10);
      expect(sent.map((m) => m.subject)).toEqual(['Second', 'First']);
      expect(sent[0]).toMatchObject({ to: 'parent@example.com', text: 'Hi' });
      expect(await mailer.list(1)).toHaveLength(1);
    });
  });
});

withParents(parentsFor.rosterTeam, () => {
  student360RepositoryContract('Postgres', () => ({
    notes: repos.studentNotes,
    insights: repos.studentInsights,
  }));
});

withParents(parentsFor.prep, () => {
  prepBatchRepositoryContract('Postgres', () => repos.prepBatches);
});

withParents(parentsFor.none, () => {
  adminContract('Postgres', () => repos);
});

withParents(parentsFor.none, () => {
  marketingContract('Postgres', () => repos);
});

withParents(parentsFor.none, () => {
  accountProtectionContract('Postgres', () => ({
    ...repos,
    jobs: new PostgresJobQueue(db, new SequentialIdGenerator('prot-job')),
  }));
});

withParents(parentsFor.none, () => {
  rateLimiterContract('PostgresRateLimiter', () => repos.rateLimiter);
});

withParents(parentsFor.school, () => {
  auditLogContract('PostgresAuditLog', () => repos.auditLog);
});
