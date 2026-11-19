import type Stripe from 'stripe';
import { err, ok, type Result } from '@thp/domain';
import type { BillingError, SubscriptionRenewal } from '@thp/ports';

/** Stripe's "cancel at period end": the subscription runs out the time paid for, then ends. */
export class StripeSubscriptionRenewal implements SubscriptionRenewal {
  constructor(private readonly stripe: Stripe) {}

  stopRenewal(externalId: string): Promise<Result<null, BillingError>> {
    return this.endAtPeriodEnd(externalId, true);
  }

  resumeRenewal(externalId: string): Promise<Result<null, BillingError>> {
    return this.endAtPeriodEnd(externalId, false);
  }

  private async endAtPeriodEnd(
    externalId: string,
    end: boolean,
  ): Promise<Result<null, BillingError>> {
    try {
      await this.stripe.subscriptions.update(externalId, { cancel_at_period_end: end });
      return ok(null);
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
