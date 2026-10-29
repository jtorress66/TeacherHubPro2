import type Stripe from 'stripe';
import {
  err,
  isValidQuantity,
  ok,
  planIds,
  type PlanId,
  type Result,
  type SchoolId,
  type SubscriptionId,
} from '@thp/domain';
import type { BillingEvent, BillingEventError, BillingEvents } from '@thp/ports';

const unsupported = err({ code: 'unsupported_event' } as const);

const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && (planIds as readonly string[]).includes(value);

/** End of the paid (or trial) period: on the subscription items since Stripe API 2025-03. */
function periodEnd(subscription: Stripe.Subscription): Date | null {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  const seconds = itemEnd ?? subscription.trial_end;
  return seconds === null ? null : new Date(seconds * 1000);
}

function created(subscription: Stripe.Subscription): Result<BillingEvent, BillingEventError> {
  const { schoolId, subscriptionId, planId, quantity } = subscription.metadata;
  const seats = Number(quantity);
  const end = periodEnd(subscription);
  if (schoolId === undefined || subscriptionId === undefined || !isPlanId(planId))
    return unsupported;
  if (!isValidQuantity(planId, seats) || end === null) return unsupported;
  return ok({
    type: 'checkout_completed',
    clientReference: subscriptionId as SubscriptionId,
    schoolId: schoolId as SchoolId,
    externalId: subscription.id,
    planId,
    quantity: seats,
    currentPeriodEnd: end,
  });
}

function updated(subscription: Stripe.Subscription): Result<BillingEvent, BillingEventError> {
  const externalId = subscription.id;
  switch (subscription.status) {
    case 'active':
    case 'trialing': {
      const end = periodEnd(subscription);
      return end === null
        ? unsupported
        : ok({ type: 'renewed', externalId, currentPeriodEnd: end });
    }
    case 'past_due':
    case 'unpaid':
      return ok({ type: 'payment_failed', externalId });
    case 'canceled':
      return ok({ type: 'canceled', externalId });
    default:
      return unsupported;
  }
}

/** Verifies Stripe's webhook signature and translates subscription events into ours. */
export class StripeBillingEvents implements BillingEvents {
  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  parseWebhook(payload: string, signature: string): Result<BillingEvent, BillingEventError> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch {
      return err({ code: 'invalid_signature' });
    }
    switch (event.type) {
      case 'customer.subscription.created':
        return created(event.data.object);
      case 'customer.subscription.updated':
        return updated(event.data.object);
      case 'customer.subscription.deleted':
        return ok({ type: 'canceled', externalId: event.data.object.id });
      default:
        return unsupported;
    }
  }
}
