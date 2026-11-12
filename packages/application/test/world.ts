import { defaultGameModes, type Email } from '@thp/domain';
import {
  FakeBillingEvents,
  InMemoryAttendanceSessionRepository,
  FakeCheckoutSessions,
  FakeGameWriter,
  FakePathWriter,
  FakeMailer,
  fakeMailTemplates,
  InMemoryPortalLinkRepository,
  InMemoryTrialReminderRepository,
  InMemoryLearningPathRepository,
  InMemoryLessonAttemptRepository,
  FakeTicketSigner,
  InMemoryLiveAnswerRepository,
  InMemoryLivePlayerRepository,
  InMemoryLiveSessionRepository,
  InMemoryGameRepository,
  InMemoryGamePlayRepository,
  SequentialSeedSource,
  FakeGoogleIdentity,
  FakePasswordHasher,
  FakeTokenHasher,
  FixedClock,
  InMemoryAssignmentRepository,
  InMemoryFileStore,
  InMemoryJobQueue,
  InMemoryLessonPlanRepository,
  InMemoryPlanFolderRepository,
  InMemoryPlanTemplateRepository,
  InMemoryAiGenerationRepository,
  InMemoryPresentationRepository,
  InMemoryRubricRepository,
  InMemorySubPacketRepository,
  InMemoryAttachmentRepository,
  InMemorySubmissionRepository,
  InMemoryStudentLinkRepository,
  InMemoryClassroomConnectionRepository,
  InMemoryFormsExportRepository,
  InMemoryStudentInsightRepository,
  InMemoryStudentNoteRepository,
  InMemoryPrepBatchRepository,
  InMemoryGradeCategoryRepository,
  InMemoryGradeRepository,
  InMemoryReportCardCommentRepository,
  InMemoryClassRepository,
  InMemoryPasswordCredentialRepository,
  InMemorySchoolRepository,
  InMemorySemesterRepository,
  InMemorySessionRepository,
  InMemoryStudentRepository,
  InMemorySubscriptionRepository,
  InMemoryUserRepository,
  SequentialIdGenerator,
  SequentialTokenGenerator,
  InMemoryAiUsageStats,
  InMemoryBlockedDomainRepository,
  InMemoryEmailConfirmationRepository,
  InMemoryRateLimiter,
} from '@thp/testing';
import { ConfirmEmail, SignUp } from '../src/index.ts';

export const googleProfile = {
  email: 'ana.google@gmail.com' as Email,
  emailVerified: true,
  name: 'Ana Google',
  picture: 'https://lh3.googleusercontent.com/a/ana',
};

/** Every port a use case may need, backed by in-memory fakes. */
export const makeWorld = () => {
  const clock = new FixedClock(new Date('2026-09-01T08:00:00.000Z'));
  const users = new InMemoryUserRepository();
  const jobs = new InMemoryJobQueue(clock, new SequentialIdGenerator('job'));
  return {
    clock,
    ids: new SequentialIdGenerator(),
    jobs,
    emailConfirmations: new InMemoryEmailConfirmationRepository(users),
    blockedDomains: new InMemoryBlockedDomainRepository(),
    aiUsage: new InMemoryAiUsageStats(jobs),
    rateLimiter: new InMemoryRateLimiter(),
    lessonPlans: new InMemoryLessonPlanRepository(),
    planFolders: new InMemoryPlanFolderRepository(),
    planTemplates: new InMemoryPlanTemplateRepository(),
    generations: new InMemoryAiGenerationRepository(),
    presentations: new InMemoryPresentationRepository(),
    rubrics: new InMemoryRubricRepository(),
    subPackets: new InMemorySubPacketRepository(),
    attachments: new InMemoryAttachmentRepository(),
    submissions: new InMemorySubmissionRepository(),
    studentLinks: new InMemoryStudentLinkRepository(),
    classroomConnections: new InMemoryClassroomConnectionRepository(),
    formsExports: new InMemoryFormsExportRepository(),
    studentNotes: new InMemoryStudentNoteRepository(),
    studentInsights: new InMemoryStudentInsightRepository(),
    prepBatches: new InMemoryPrepBatchRepository(),
    tokens: new SequentialTokenGenerator(),
    tokenHasher: new FakeTokenHasher(),
    passwordHasher: new FakePasswordHasher(),
    users,
    schools: new InMemorySchoolRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    credentials: new InMemoryPasswordCredentialRepository(),
    sessions: new InMemorySessionRepository(),
    classes: new InMemoryClassRepository(),
    students: new InMemoryStudentRepository(),
    semesters: new InMemorySemesterRepository(),
    attendanceSessions: new InMemoryAttendanceSessionRepository(),
    gradeCategories: new InMemoryGradeCategoryRepository(),
    assignments: new InMemoryAssignmentRepository(),
    grades: new InMemoryGradeRepository(),
    reportCardComments: new InMemoryReportCardCommentRepository(),
    games: new InMemoryGameRepository(),
    gamePlays: new InMemoryGamePlayRepository(),
    seeds: new SequentialSeedSource(),
    gameModes: defaultGameModes,
    gameWriter: new FakeGameWriter(),
    liveSessions: new InMemoryLiveSessionRepository(),
    livePlayers: new InMemoryLivePlayerRepository(),
    liveAnswers: new InMemoryLiveAnswerRepository(),
    ticketSigner: new FakeTicketSigner(),
    learningPaths: new InMemoryLearningPathRepository(),
    lessonAttempts: new InMemoryLessonAttemptRepository(),
    pathWriter: new FakePathWriter(),
    portalLinks: new InMemoryPortalLinkRepository(),
    trialReminders: new InMemoryTrialReminderRepository(),
    mailer: new FakeMailer(),
    mailTemplates: fakeMailTemplates,
    files: new InMemoryFileStore(),
    google: new FakeGoogleIdentity({
      'good-code': googleProfile,
      'unverified-code': {
        ...googleProfile,
        email: 'new@gmail.com' as Email,
        emailVerified: false,
      },
    }),
    checkout: new FakeCheckoutSessions(),
    billingEvents: new FakeBillingEvents(),
    appUrl: 'https://app.teacherhub.test',
  };
};

export type World = ReturnType<typeof makeWorld>;

export const password = 'correct horse battery';

export const signUpInput = (email = 'ana@school.edu') => ({
  name: 'Ana López',
  email,
  password,
  language: 'es',
  defaultSchoolName: 'Mi escuela',
  adult: true,
});

/** The secret of the newest emailed link to an address (it follows the link's #). */
export function emailedToken(world: World, email: string): string {
  const mail = [...world.mailer.outbox].reverse().find((m) => m.to === email);
  const token = /#([^\s"]+)/u.exec(mail?.text ?? '')?.[1];
  if (token === undefined) throw new Error(`no link for ${email}`);
  return token;
}

/** A teacher who has just signed up with email and password, before confirming their email. */
export async function signedUpUnconfirmed(world: World, email?: string) {
  const result = await new SignUp(world).execute(signUpInput(email));
  if (!result.ok) throw new Error(`sign-up failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

/**
 * A teacher who has signed up and confirmed their email from the emailed link. The confirmation
 * email is read and taken out of the outbox, so tests see only the mail they cause.
 */
export async function signedUp(world: World, email?: string) {
  const account = await signedUpUnconfirmed(world, email);
  const confirmed = await new ConfirmEmail(world).execute({
    token: emailedToken(world, account.user.email),
  });
  if (!confirmed.ok) throw new Error(`confirmation failed: ${JSON.stringify(confirmed.error)}`);
  const read = world.mailer.outbox.findLastIndex((m) => m.to === account.user.email);
  world.mailer.outbox.splice(read, 1);
  return { ...account, user: confirmed.value };
}

const day = 24 * 60 * 60 * 1000;

export const advanceDays = (world: World, days: number): void => {
  world.clock.advanceBy(days * day);
};
