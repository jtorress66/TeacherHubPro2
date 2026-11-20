import { accessFor, hasConfirmedEmail, ok, type Result, type User } from '@thp/domain';
import type { Clock, SchoolRepository, SubscriptionRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findSchoolSubscription } from './school-subscription.ts';

type Actor = Pick<User, 'role' | 'schoolId' | 'emailConfirmedAt'>;

/**
 * Paid features need a confirmed email and the school's active trial or plan; super admins always
 * have access. Read-aloud uses this alone: listening is not drafting.
 */
export async function checkPaidAccess(
  deps: { readonly subscriptions: SubscriptionRepository; readonly clock: Clock },
  actor: Actor,
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

/** AI drafting: paid access, and the school has not turned AI off. */
export async function checkAiAccess(
  deps: {
    readonly subscriptions: SubscriptionRepository;
    readonly schools: SchoolRepository;
    readonly clock: Clock;
  },
  actor: Actor,
): Promise<Result<true, UseCaseError>> {
  const paid = await checkPaidAccess(deps, actor);
  if (!paid.ok) return paid;
  if (actor.role === 'super_admin') return paid;
  const school = await deps.schools.findById(actor.schoolId);
  return school === null || school.features.ai ? paid : fail('ai_off_for_school');
}
