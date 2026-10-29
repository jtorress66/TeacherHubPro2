import type { Email, PlanId, Result, SchoolId, SubscriptionId } from '@thp/domain';

export interface CheckoutRequest {
  readonly planId: PlanId;
  readonly quantity: number;
  readonly customerEmail: Email;
  /** Our subscription and its school, echoed back by billing events. */
  readonly clientReference: SubscriptionId;
  readonly schoolId: SchoolId;
  /** When the free trial ends; the first charge happens then. Null when the trial is over. */
  readonly trialEnd: Date | null;
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
