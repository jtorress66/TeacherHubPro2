import {
  activateSubscription,
  cancelSubscription,
  markPastDue,
  ok,
  renewSubscription,
  type Result,
  type Subscription,
  type SubscriptionError,
  type ValidationError,
} from '@thp/domain';
import type { BillingEvent, BillingEvents, SubscriptionRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

export interface HandleBillingWebhookDeps {
  readonly billingEvents: BillingEvents;
  readonly subscriptions: SubscriptionRepository;
}

type EventOf<T extends BillingEvent['type']> = Extract<BillingEvent, { type: T }>;
type Outcome = Result<Subscription, SubscriptionError | ValidationError>;
type Apply<T extends BillingEvent['type']> = (sub: Subscription, event: EventOf<T>) => Outcome;

/** How each event changes a subscription. A replay finds it already changed and leaves it. */
const appliers: { readonly [T in BillingEvent['type']]: Apply<T> } = {
  checkout_completed: (sub, event) =>
    sub.status === 'active' && sub.externalId === event.externalId
      ? ok(sub)
      : activateSubscription(sub, {
          currentPeriodEnd: event.currentPeriodEnd,
          externalId: event.externalId,
          planId: event.planId,
          quantity: event.quantity,
        }),
  renewed: (sub, event) => renewSubscription(sub, event.currentPeriodEnd),
  payment_failed: (sub) => (sub.status === 'past_due' ? ok(sub) : markPastDue(sub)),
  canceled: (sub) => (sub.status === 'canceled' ? ok(sub) : cancelSubscription(sub)),
};

function applyEvent<T extends BillingEvent['type']>(sub: Subscription, event: EventOf<T>): Outcome {
  return (appliers[event.type] as Apply<T>)(sub, event);
}

/**
 * Applies a verified billing webhook. An error makes the provider retry (for example when an
 * event arrives before the subscription it refers to); events that no longer fit are ignored.
 */
export class HandleBillingWebhook {
  constructor(private readonly deps: HandleBillingWebhookDeps) {}

  async execute(input: {
    payload: string;
    signature: string;
  }): Promise<Result<{ handled: boolean }, UseCaseError>> {
    const parsed = this.deps.billingEvents.parseWebhook(input.payload, input.signature);
    if (!parsed.ok) {
      return parsed.error.code === 'invalid_signature'
        ? fail('invalid_signature')
        : ok({ handled: false });
    }
    const event = parsed.value;
    const subscription = await this.find(event);
    if (!subscription) return fail('unknown_subscription');

    const outcome = applyEvent(subscription, event);
    if (!outcome.ok) {
      return 'field' in outcome.error ? fail('below_minimum_seats') : ok({ handled: false });
    }
    if (outcome.value !== subscription) await this.deps.subscriptions.save(outcome.value);
    return ok({ handled: true });
  }

  private find(event: BillingEvent): Promise<Subscription | null> {
    return event.type === 'checkout_completed'
      ? this.deps.subscriptions.findById(event.schoolId, event.clientReference)
      : this.deps.subscriptions.findByExternalId(event.externalId);
  }
}
