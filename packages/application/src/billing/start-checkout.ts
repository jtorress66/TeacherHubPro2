import { isAdminOf, isValidQuantity, ok, type PlanId, type Result, type User } from '@thp/domain';
import type { CheckoutSessions, Clock, SubscriptionRepository } from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';

export interface StartCheckoutDeps {
  readonly checkout: CheckoutSessions;
  readonly subscriptions: SubscriptionRepository;
  readonly clock: Clock;
  readonly appUrl: string;
}

export interface CheckoutInput {
  readonly actor: User;
  readonly planId: PlanId;
  readonly quantity: number;
  /** The interface language, so the teacher returns to the same language. */
  readonly locale: string;
}

/**
 * Opens a hosted checkout for the school's subscription. During the free trial the first charge is
 * set for the trial's end, so subscribing early never costs free days.
 */
export class StartCheckout {
  constructor(private readonly deps: StartCheckoutDeps) {}

  async execute(input: CheckoutInput): Promise<Result<{ url: string }, UseCaseError>> {
    const { actor } = input;
    const subscription = await findSchoolSubscription(this.deps.subscriptions, actor.schoolId);
    if (!subscription) return fail('not_found');
    if (subscription.ownerId !== actor.id && !isAdminOf(actor, actor.schoolId)) {
      return fail('forbidden');
    }
    if (subscription.status === 'active' || subscription.status === 'past_due') {
      return fail('already_subscribed');
    }
    if (subscription.status !== 'trialing') return fail('subscription_ended');
    if (!isValidQuantity(input.planId, input.quantity)) return fail('below_minimum_seats');

    const now = this.deps.clock.now();
    const billingPage = `${this.deps.appUrl}/${input.locale}/app/billing`;
    const session = await this.deps.checkout.createCheckout({
      planId: input.planId,
      quantity: input.quantity,
      customerEmail: actor.email,
      clientReference: subscription.id,
      schoolId: subscription.schoolId,
      trialEnd: now < subscription.trialEndsAt ? subscription.trialEndsAt : null,
      successUrl: `${billingPage}?checkout=success`,
      cancelUrl: `${billingPage}?checkout=canceled`,
    });
    return session.ok ? ok({ url: session.value.url }) : fail('billing_failed');
  }
}
