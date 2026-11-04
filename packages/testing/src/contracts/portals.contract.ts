import { describe, expect, it } from 'vitest';
import type { ClassId, Email, PortalLinkId, SchoolId, SubscriptionId } from '@thp/domain';
import type {
  PortalLinkRepository,
  SubscriptionRepository,
  TrialEndingLookup,
  TrialReminderRepository,
} from '@thp/ports';
import { aPortalLink, aSubscription } from '../fixtures.ts';
import { scopedRepositoryContract } from './scoped-repository.contract.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export interface PortalRepositories {
  readonly portalLinks: PortalLinkRepository;
  readonly trialReminders: TrialReminderRepository;
  readonly subscriptions: SubscriptionRepository & TrialEndingLookup;
}

/**
 * Shared suites for portal links, trial reminders and the trials-ending lookup. Fixtures use
 * class-1 and student-1 in school-a, and teacher-1 as the subscription owner, so Postgres tests
 * seed those parents.
 */
export function portalRepositoryContract(name: string, make: () => PortalRepositories): void {
  const links = {
    make: () => make().portalLinks,
    sample: (schoolId: SchoolId, id: string) =>
      aPortalLink({ schoolId, id: id as PortalLinkId, tokenHash: `hash-${schoolId}-${id}` }),
  };
  scopedRepositoryContract(`${name} portal links`, {
    ...links,
    change: (link) => ({ ...link, sentTo: 'parent@example.com' as Email }),
    lists: [
      {
        name: 'listByClass',
        call: (repo, schoolId, link) => repo.listByClass(schoolId, link.classId),
      },
    ],
  });

  describe(`${name} (PortalLinkRepository)`, () => {
    it('finds a link by its token hash, in any school, and lists a class’s links', async () => {
      const repo = make().portalLinks;
      const link = aPortalLink({ schoolId: schoolA, tokenHash: 'hash-abc' });
      await repo.save(link);
      expect(await repo.findByTokenHash('hash-abc')).toEqual(link);
      expect(await repo.findByTokenHash('hash-other')).toBeNull();
      expect(await repo.listByClass(schoolA, 'class-9' as ClassId)).toEqual([]);
      expect(await repo.listByClass(schoolB, link.classId)).toEqual([]);
    });
  });

  describe(`${name} (TrialReminderRepository)`, () => {
    it('remembers which reminders went out for a trial; recording again changes nothing', async () => {
      const { trialReminders, subscriptions } = make();
      const subscription = aSubscription({ schoolId: schoolA });
      await subscriptions.save(subscription);
      const sentAt = new Date('2026-11-04T10:00:00Z');
      expect(await trialReminders.sentKinds(subscription.id)).toEqual([]);
      await trialReminders.record({
        subscriptionId: subscription.id,
        schoolId: schoolA,
        kind: 'three_days',
        sentAt,
      });
      await trialReminders.record({
        subscriptionId: subscription.id,
        schoolId: schoolA,
        kind: 'three_days',
        sentAt,
      });
      expect(await trialReminders.sentKinds(subscription.id)).toEqual(['three_days']);
      expect(await trialReminders.sentKinds('subscription-9' as SubscriptionId)).toEqual([]);
    });
  });

  describe(`${name} (TrialEndingLookup)`, () => {
    it('lists trialing subscriptions whose trial ends in the window, across schools', async () => {
      const { subscriptions } = make();
      const now = new Date('2026-11-04T10:00:00Z');
      const soon = aSubscription({ schoolId: schoolA, now: new Date('2026-10-31T10:00:00Z') });
      const later = aSubscription({
        schoolId: schoolB,
        id: 'subscription-2' as SubscriptionId,
        now: new Date('2026-11-04T10:00:00Z'),
      });
      await subscriptions.save(soon);
      await subscriptions.save(later);
      const until = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      expect((await subscriptions.listTrialsEnding(now, until)).map((s) => s.id)).toEqual([
        soon.id,
      ]);
      await subscriptions.save({ ...soon, status: 'active' });
      expect(await subscriptions.listTrialsEnding(now, until)).toEqual([]);
    });
  });
}
