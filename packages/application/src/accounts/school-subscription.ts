import type { SchoolId, Subscription } from '@thp/domain';
import type { SubscriptionRepository } from '@thp/ports';

/** The school's current subscription: the most recent one. */
export async function findSchoolSubscription(
  subscriptions: SubscriptionRepository,
  schoolId: SchoolId,
): Promise<Subscription | null> {
  const all = await subscriptions.listBySchool(schoolId);
  return all.at(-1) ?? null;
}
