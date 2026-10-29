import type { Result, SubscriptionId } from '@thp/domain';

export type BillingEvent =
  | {
      readonly type: 'checkout_completed';
      readonly clientReference: SubscriptionId;
      readonly externalId: string;
      readonly currentPeriodEnd: Date;
    }
  | { readonly type: 'renewed'; readonly externalId: string; readonly currentPeriodEnd: Date }
  | { readonly type: 'payment_failed'; readonly externalId: string }
  | { readonly type: 'canceled'; readonly externalId: string };

export interface BillingEventError {
  readonly code: 'invalid_signature' | 'unsupported_event';
}

/** Verifies and translates payment-provider webhooks into our own events. */
export interface BillingEvents {
  parseWebhook(payload: string, signature: string): Result<BillingEvent, BillingEventError>;
}
