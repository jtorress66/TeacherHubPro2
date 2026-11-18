import type Stripe from 'stripe';
import { err, ok, type Result } from '@thp/domain';
import type { BillingError, BillingRewards } from '@thp/ports';

/**
 * Free time on a Stripe subscription: its trial end is moved to the new date, which Stripe treats
 * as free days before the next invoice. Nothing is prorated or refunded.
 */
export class StripeBillingRewards implements BillingRewards {
  constructor(private readonly stripe: Stripe) {}

  async delayNextCharge(externalId: string, until: Date): Promise<Result<null, BillingError>> {
    try {
      await this.stripe.subscriptions.update(externalId, {
        trial_end: Math.floor(until.getTime() / 1000),
        proration_behavior: 'none',
      });
      return ok(null);
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
