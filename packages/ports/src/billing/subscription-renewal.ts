import type { Result } from '@thp/domain';
import type { BillingError } from './checkout-sessions.ts';

/** Whether a paid subscription renews at the end of the period it is in, at the payment provider. */
export interface SubscriptionRenewal {
  /** The subscription ends with its current period; nothing more is charged. */
  stopRenewal(externalId: string): Promise<Result<null, BillingError>>;
  /** Undoes `stopRenewal` while the period lasts. */
  resumeRenewal(externalId: string): Promise<Result<null, BillingError>>;
}
