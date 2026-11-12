import { accountProtectionContract } from '../contracts/account-protections.contract.ts';
import { FixedClock } from '../fixed-clock.ts';
import { SequentialIdGenerator } from '../sequential-id-generator.ts';
import {
  InMemoryAiUsageStats,
  InMemoryBlockedDomainRepository,
  InMemoryEmailConfirmationRepository,
} from './account-protections.ts';
import { InMemoryUserDirectory } from './admin.ts';
import { InMemoryJobQueue } from './job-queue.ts';
import {
  InMemoryAiGenerationRepository,
  InMemoryClassRepository,
  InMemoryGradeRepository,
  InMemoryLessonPlanRepository,
  InMemoryPresentationRepository,
  InMemorySchoolRepository,
  InMemoryStudentRepository,
  InMemorySubscriptionRepository,
  InMemoryUserRepository,
} from './repositories.ts';

accountProtectionContract('InMemory', () => {
  const stores = {
    schools: new InMemorySchoolRepository(),
    users: new InMemoryUserRepository(),
    classes: new InMemoryClassRepository(),
    students: new InMemoryStudentRepository(),
    lessonPlans: new InMemoryLessonPlanRepository(),
    presentations: new InMemoryPresentationRepository(),
    generations: new InMemoryAiGenerationRepository(),
    grades: new InMemoryGradeRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
  };
  const jobs = new InMemoryJobQueue(new FixedClock(new Date()), new SequentialIdGenerator());
  return {
    ...stores,
    jobs,
    userDirectory: new InMemoryUserDirectory(stores),
    emailConfirmations: new InMemoryEmailConfirmationRepository(stores.users),
    blockedDomains: new InMemoryBlockedDomainRepository(),
    aiUsage: new InMemoryAiUsageStats(jobs),
  };
});
