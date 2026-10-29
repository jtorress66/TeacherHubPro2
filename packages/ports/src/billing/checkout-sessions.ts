import type { Email, PlanId, Result, SubscriptionId } from '@thp/domain';

export interface CheckoutRequest {
  readonly planId: PlanId;
  readonly quantity: number;
  readonly customerEmail: Email;
  /** Our subscription id, echoed back by billing events. */
  readonly clientReference: SubscriptionId;
  readonly trialDays: number;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface CheckoutSession {
  readonly sessionId: string;
  readonly url: string;
}

export interface BillingError {
  readonly code: 'invalid_request' | 'unavailable';
}

export interface CheckoutSessions {
  createCheckout(request: CheckoutRequest): Promise<Result<CheckoutSession, BillingError>>;
}
