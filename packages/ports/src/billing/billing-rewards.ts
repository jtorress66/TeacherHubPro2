import type { Result } from '@thp/domain';
import type { BillingError } from './checkout-sessions.ts';

/** Free time on a paid subscription, given through the payment provider. */
export interface BillingRewards {
  /** Moves the next charge to `until`; the days before it are not charged. */
  delayNextCharge(externalId: string, until: Date): Promise<Result<null, BillingError>>;
}
