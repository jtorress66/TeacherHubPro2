import type { PlanId, Result, SchoolId, SubscriptionId } from '@thp/domain';

export type BillingEvent =
  | {
      readonly type: 'checkout_completed';
      readonly clientReference: SubscriptionId;
      readonly schoolId: SchoolId;
      readonly externalId: string;
      readonly planId: PlanId;
      readonly quantity: number;
      readonly currentPeriodEnd: Date;
      /** True once money was taken; false while the subscription is still in its free trial. */
      readonly paid: boolean;
    }
  | {
      readonly type: 'renewed';
      readonly externalId: string;
      readonly currentPeriodEnd: Date;
      readonly paid: boolean;
    }
  | { readonly type: 'payment_failed'; readonly externalId: string }
  | { readonly type: 'canceled'; readonly externalId: string };

export interface BillingEventError {
  readonly code: 'invalid_signature' | 'unsupported_event';
}

/** Verifies and translates payment-provider webhooks into our own events. */
export interface BillingEvents {
  parseWebhook(payload: string, signature: string): Result<BillingEvent, BillingEventError>;
}
