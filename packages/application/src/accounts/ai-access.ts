import { accessFor, hasConfirmedEmail, ok, type Result, type User } from '@thp/domain';
import type { Clock, SubscriptionRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findSchoolSubscription } from './school-subscription.ts';

/**
 * AI features need a confirmed email and the school's active trial or plan; super admins always
 * have access.
 */
export async function checkAiAccess(
  deps: { readonly subscriptions: SubscriptionRepository; readonly clock: Clock },
  actor: Pick<User, 'role' | 'schoolId' | 'emailConfirmedAt'>,
): Promise<Result<true, UseCaseError>> {
  if (!hasConfirmedEmail(actor)) return fail('email_unconfirmed');
  const subscription =
    actor.role === 'super_admin'
      ? null
      : await findSchoolSubscription(deps.subscriptions, actor.schoolId);
  return accessFor(actor, subscription, deps.clock.now()).hasAccess
    ? ok(true)
    : fail('subscription_required');
}
