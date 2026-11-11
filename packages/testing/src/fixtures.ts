import {
  connectCanva,
  connectMicrosoft,
  connectClassroom,
  createAttachment,
  createStudentLink,
  type Attachment,
  type ClassroomConnection,
  type StudentLink,
  createContentRequest,
  createGeneration,
  createPresentation,
  createRubric,
  createSubPacket,
  type AiGeneration,
  type Presentation,
  type Rubric,
  type SubPacket,
  createAssignment,
  createClass,
  createGame,
  createGamePlay,
  createLiveSession,
  createLearningPath,
  createPortalLink,
  type PortalLink,
  type LearningLesson,
  type LearningPath,
  type LearningPathInput,
  type LessonAttempt,
  joinPlayer,
  defaultGameModes,
  createGrade,
  createGradeCategory,
  createLessonPlan,
  createPlanFolder,
  templateFromPlan,
  type PlanFolder,
  type PlanTemplate,
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
  CanvaConnection,
  MicrosoftConnection,
  GamePlay,
  LiveAnswer,
  LivePlayer,
  LivePlayerId,
  LiveSession,
  LiveSessionId,
  LiveSessionInput,
  LearningPathId,
  LessonAttemptId,
  PortalLinkId,
  GamePlayId,
  AssignmentId,
  AttendanceSessionId,
  AttachmentId,
  StudentLinkId,
  GenerationId,
  PresentationId,
  RubricId,
  ClassId,
  GameId,
  GradeCategoryId,
  GradeId,
  LessonPlanId,
  PlanFolderId,
  PlanTemplateId,
  ReportCardCommentId,
  SchoolId,
  SemesterId,
  StudentId,
  SubmissionId,
  SubscriptionId,
  UserId,
} from '@thp/domain';
import { sampleGameContent } from './game-content.ts';
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
      body: { kind: 'weekly', weeks: [{ weekStart: '2026-09-07' }] },
      ...overrides,
    }),
  );

export const aPlanFolder = (overrides: Partial<PlanFolder> = {}): PlanFolder =>
  unwrap(
    createPlanFolder({
      id: 'folder-1' as PlanFolderId,
      schoolId,
      teacherId,
      name: 'Unit 1',
      ...overrides,
    }),
  );

export const aPlanTemplate = (overrides: Partial<PlanTemplate> = {}): PlanTemplate => ({
  ...unwrap(templateFromPlan(aLessonPlan(), 'template-1' as PlanTemplateId, 'My week')),
  ...overrides,
});

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
    createGame(
      {
        id: 'game-1' as GameId,
        schoolId,
        teacherId,
        title: 'Planets',
        mode: 'quiz',
        content: sampleGameContent.questions,
        createdAt: new Date('2026-11-01T12:00:00Z'),
        ...overrides,
      },
      defaultGameModes,
    ),
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

export const aContentRequest = (
  overrides: Partial<Parameters<typeof createContentRequest>[0]> = {},
) =>
  unwrap(
    createContentRequest({
      type: 'worksheet',
      subject: 'math',
      grade: '4',
      topic: 'Equivalent fractions',
      language: 'en',
      ...overrides,
    }),
  );

export const aGeneration = (overrides: Partial<AiGeneration> = {}): AiGeneration => ({
  ...unwrap(
    createGeneration({
      id: 'gen-1' as GenerationId,
      schoolId,
      teacherId,
      request: aContentRequest(),
      content: ['# Worksheet', '', '1. Compare 1/2 and 2/4: ___'].join('\n'),
      createdAt: new Date('2026-10-30T12:00:00Z'),
    }),
  ),
  ...overrides,
});

export const aPresentation = (overrides: Partial<Presentation> = {}): Presentation => ({
  ...unwrap(
    createPresentation({
      id: 'pres-1' as PresentationId,
      schoolId,
      teacherId,
      name: 'Plants',
      topic: 'Parts of a plant',
      subject: 'science',
      grade: '3',
      slides: [
        { layout: 'title', title: 'Plants', subtitle: 'Grade 3 science', emoji: '🌱' },
        { layout: 'content', title: 'Parts', bullets: ['Roots', 'Stem', 'Leaves'] },
      ],
      now: new Date('2026-10-30T12:00:00Z'),
    }),
  ),
  ...overrides,
});

export const aRubric = (overrides: Partial<Rubric> = {}): Rubric => ({
  ...unwrap(
    createRubric({
      id: 'rubric-1' as RubricId,
      schoolId,
      teacherId,
      title: 'Lab report',
      subject: 'science',
      grade: '6',
      levels: [
        { label: 'Excellent', points: 4 },
        { label: 'Needs work', points: 1 },
      ],
      criteria: [{ name: 'Method', descriptors: ['Every step clear', 'Steps missing'] }],
      now: new Date('2026-11-01T12:00:00Z'),
    }),
  ),
  ...overrides,
});

export const aSubPacket = (overrides: Partial<SubPacket> = {}): SubPacket => ({
  ...unwrap(
    createSubPacket({
      classId,
      schoolId,
      mainOfficeExt: 'Ext. 100',
      nurseExt: 'Ext. 105',
      dailyRoutines: 'Line up at 8:00',
    }),
  ),
  ...overrides,
});

export const anAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  ...unwrap(
    createAttachment({
      id: 'attachment-1' as AttachmentId,
      schoolId,
      assignmentId: 'assignment-1' as AssignmentId,
      name: 'worksheet.pdf',
      contentType: 'application/pdf',
      size: 2048,
    }),
  ),
  ...overrides,
});

export const aGamePlay = (overrides: Partial<GamePlay> = {}): GamePlay =>
  unwrap(
    createGamePlay({
      id: 'play-1' as GamePlayId,
      schoolId,
      gameId: 'game-1' as GameId,
      classId,
      studentId: 'student-1' as StudentId,
      mode: 'quiz',
      seed: 7,
      score: 3,
      total: 4,
      durationMs: 45_000,
      playedAt: new Date('2026-11-01T10:00:00Z'),
      ...overrides,
    }),
  );

export const aLiveSession = (overrides: Partial<LiveSessionInput> = {}): LiveSession =>
  unwrap(
    createLiveSession({
      id: 'live-1' as LiveSessionId,
      schoolId,
      teacherId,
      gameId: 'game-1' as GameId,
      classId,
      kind: 'live',
      mode: 'quiz',
      pin: '482913',
      seed: 11,
      questionCount: 4,
      questionSeconds: 20,
      createdAt: new Date('2026-11-04T10:00:00Z'),
      ...overrides,
    }),
  );

export const aLivePlayer = (overrides: Partial<LivePlayer> = {}): LivePlayer => ({
  ...unwrap(
    joinPlayer({
      id: 'player-1' as LivePlayerId,
      schoolId,
      sessionId: 'live-1' as LiveSessionId,
      studentId: 'student-1' as StudentId,
      firstName: 'Ana',
      tokenHash: 'hash-player-1',
      joinedAt: new Date('2026-11-04T10:01:00Z'),
    }),
  ),
  ...overrides,
});

export const aLiveAnswer = (overrides: Partial<LiveAnswer> = {}): LiveAnswer => ({
  schoolId,
  sessionId: 'live-1' as LiveSessionId,
  playerId: 'player-1' as LivePlayerId,
  question: 0,
  prompt: 'Which is the largest planet?',
  choice: 1,
  correct: true,
  ms: 4000,
  points: 900,
  ...overrides,
});

export const aStudentLink = (overrides: Partial<StudentLink> = {}): StudentLink => ({
  ...createStudentLink({
    id: 'link-1' as StudentLinkId,
    schoolId,
    classId,
    studentId: 'student-1' as StudentId,
    tokenHash: 'hash-1',
    expiresAt: new Date('2027-01-31T00:00:00Z'),
  }),
  ...overrides,
});

export const aClassroomConnection = (
  overrides: Partial<ClassroomConnection> = {},
): ClassroomConnection => ({
  ...connectClassroom({
    schoolId,
    teacherId,
    encryptedRefreshToken: 'sealed-1',
    connectedAt: new Date('2026-09-01T12:00:00Z'),
  }),
  ...overrides,
});

export const aCanvaConnection = (overrides: Partial<CanvaConnection> = {}): CanvaConnection => ({
  ...connectCanva({
    schoolId,
    teacherId,
    encryptedRefreshToken: 'sealed-1',
    connectedAt: new Date('2026-09-01T12:00:00Z'),
  }),
  ...overrides,
});

export const aMicrosoftConnection = (
  overrides: Partial<MicrosoftConnection> = {},
): MicrosoftConnection => ({
  ...connectMicrosoft({
    schoolId,
    teacherId,
    encryptedRefreshToken: 'sealed-1',
    teams: false,
    connectedAt: new Date('2026-09-01T12:00:00Z'),
  }),
  ...overrides,
});

/** A valid lesson; its checks' right answers are options 1, 0 and 1. */
export const aLearningLesson = (
  n = 1,
  overrides: Partial<LearningLesson> = {},
): LearningLesson => ({
  title: `Comparing fractions, part ${String(n)}`,
  objective: `Compare fractions with like denominators (${String(n)})`,
  minutes: 15,
  content: 'A fraction names part of a whole. When the bottom numbers match, compare the tops.',
  checks: [
    { prompt: `Which is larger: 3/8 or 5/8? (${String(n)})`, options: ['3/8', '5/8'], answer: 1 },
    { prompt: `Which is smaller: 1/4 or 3/4? (${String(n)})`, options: ['1/4', '3/4'], answer: 0 },
    { prompt: `Is 2/6 less than 4/6? (${String(n)})`, options: ['No', 'Yes'], answer: 1 },
  ],
  ...overrides,
});

/** A draft path for student-1 in math; pass `status` and `assignedAt` for an assigned one. */
export const aLearningPath = (
  overrides: Partial<LearningPathInput> & Partial<Pick<LearningPath, 'status' | 'assignedAt'>> = {},
): LearningPath => {
  const { status, assignedAt, ...input } = overrides;
  return {
    ...unwrap(
      createLearningPath({
        id: 'path-1' as LearningPathId,
        schoolId,
        teacherId,
        studentId: 'student-1' as StudentId,
        classId,
        subject: 'math',
        grade: '4',
        language: 'en',
        level: 3,
        title: 'Fractions, step by step',
        description: 'Comparing and ordering fractions.',
        lessons: [aLearningLesson(1), aLearningLesson(2), aLearningLesson(3)],
        createdAt: new Date('2026-11-04T10:00:00Z'),
        ...input,
      }),
    ),
    ...(status === undefined ? {} : { status }),
    ...(assignedAt === undefined ? {} : { assignedAt }),
  };
};

export const aLessonAttempt = (overrides: Partial<LessonAttempt> = {}): LessonAttempt => ({
  id: 'attempt-1' as LessonAttemptId,
  schoolId,
  pathId: 'path-1' as LearningPathId,
  studentId: 'student-1' as StudentId,
  lesson: 0,
  answers: [1, 0, 1],
  score: 2,
  total: 3,
  at: new Date('2026-11-04T11:00:00Z'),
  ...overrides,
});

export const aPortalLink = (overrides: Partial<PortalLink> = {}): PortalLink => ({
  ...createPortalLink({
    id: 'portal-1' as PortalLinkId,
    schoolId,
    classId,
    studentId: 'student-1' as StudentId,
    tokenHash: 'portal-hash-1',
    sentTo: null,
    expiresAt: new Date('2027-01-31T00:00:00Z'),
  }),
  ...overrides,
});
