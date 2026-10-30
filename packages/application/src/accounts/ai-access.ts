import { hasAccess, ok, type Result, type SchoolId } from '@thp/domain';
import type { Clock, SubscriptionRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findSchoolSubscription } from './school-subscription.ts';

/** AI features need the school's subscription or trial to be active. */
export async function checkAiAccess(
  deps: { readonly subscriptions: SubscriptionRepository; readonly clock: Clock },
  schoolId: SchoolId,
): Promise<Result<true, UseCaseError>> {
  const subscription = await findSchoolSubscription(deps.subscriptions, schoolId);
  return subscription && hasAccess(subscription, deps.clock.now())
    ? ok(true)
    : fail('subscription_required');
}
