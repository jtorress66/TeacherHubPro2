import type { Email } from '@thp/domain';
import {
  FakeBillingEvents,
  InMemoryAttendanceSessionRepository,
  FakeCheckoutSessions,
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
  InMemorySubPacketRepository,
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
} from '@thp/testing';
import { SignUp } from '../src/index.ts';

export const googleProfile = {
  email: 'ana.google@gmail.com' as Email,
  emailVerified: true,
  name: 'Ana Google',
  picture: 'https://lh3.googleusercontent.com/a/ana',
};

/** Every port a use case may need, backed by in-memory fakes. */
export const makeWorld = () => {
  const clock = new FixedClock(new Date('2026-09-01T08:00:00.000Z'));
  return {
    clock,
    ids: new SequentialIdGenerator(),
    jobs: new InMemoryJobQueue(clock, new SequentialIdGenerator('job')),
    lessonPlans: new InMemoryLessonPlanRepository(),
    planFolders: new InMemoryPlanFolderRepository(),
    planTemplates: new InMemoryPlanTemplateRepository(),
    generations: new InMemoryAiGenerationRepository(),
    presentations: new InMemoryPresentationRepository(),
    subPackets: new InMemorySubPacketRepository(),
    tokens: new SequentialTokenGenerator(),
    tokenHasher: new FakeTokenHasher(),
    passwordHasher: new FakePasswordHasher(),
    users: new InMemoryUserRepository(),
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
});

/** A teacher who has just signed up with email and password. */
export async function signedUp(world: World, email?: string) {
  const result = await new SignUp(world).execute(signUpInput(email));
  if (!result.ok) throw new Error(`sign-up failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

const day = 24 * 60 * 60 * 1000;

export const advanceDays = (world: World, days: number): void => {
  world.clock.advanceBy(days * day);
};
