import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  err,
  ok,
  planCatalog,
  type PlanId,
  type Result,
  type SchoolId,
  type SubscriptionId,
} from '@thp/domain';
import type {
  BillingError,
  BillingEvent,
  BillingEventError,
  BillingEvents,
  CheckoutRequest,
  CheckoutSession,
  CheckoutSessions,
} from '@thp/ports';

/**
 * Development and E2E stand-in for a payment provider. The checkout is a page inside the app
 * whose "Pay" button sends an HMAC-signed webhook through the same endpoint and verification
 * path as Stripe. The web config refuses it in production.
 */
export class LocalCheckoutSessions implements CheckoutSessions {
  constructor(private readonly appUrl: string) {}

  createCheckout(request: CheckoutRequest): Promise<Result<CheckoutSession, BillingError>> {
    const url = new URL('/billing/local-checkout', this.appUrl);
    url.search = new URLSearchParams({
      plan: request.planId,
      quantity: String(request.quantity),
      subscription: request.clientReference,
      school: request.schoolId,
      email: request.customerEmail,
      success: request.successUrl,
      cancel: request.cancelUrl,
    }).toString();
    return Promise.resolve(
      ok({ sessionId: `local_${request.clientReference}`, url: url.toString() }),
    );
  }
}

type LocalEvent = BillingEvent | { readonly type: 'local.ignored' };

const hmac = (secret: string, payload: string): string =>
  `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

export function signLocalWebhook(
  secret: string,
  event: LocalEvent,
): { readonly payload: string; readonly signature: string } {
  const payload = JSON.stringify(event);
  return { payload, signature: hmac(secret, payload) };
}

const reviveDates = (_key: string, value: unknown): unknown =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value;

const handled: ReadonlySet<string> = new Set<BillingEvent['type']>([
  'checkout_completed',
  'renewed',
  'payment_failed',
  'canceled',
]);

export class LocalBillingEvents implements BillingEvents {
  constructor(private readonly secret: string) {}

  parseWebhook(payload: string, signature: string): Result<BillingEvent, BillingEventError> {
    const expected = Buffer.from(hmac(this.secret, payload));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return err({ code: 'invalid_signature' });
    }
    const event = JSON.parse(payload, reviveDates) as LocalEvent;
    return handled.has(event.type) ? ok(event as BillingEvent) : err({ code: 'unsupported_event' });
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface LocalPurchase {
  readonly subscriptionId: SubscriptionId;
  readonly schoolId: SchoolId;
  readonly planId: PlanId;
  readonly quantity: number;
}

/** Plays the payment provider for the local checkout page: after "payment" it sends the webhook. */
export class LocalCheckoutSimulator {
  static readonly signatureHeader = 'x-teacherhub-signature';

  constructor(
    private readonly appUrl: string,
    private readonly secret: string,
    private readonly fetchFn: Fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async pay(purchase: LocalPurchase): Promise<Result<null, 'webhook_rejected'>> {
    const periodEnd = new Date(this.now());
    const months = planCatalog[purchase.planId].billedEvery === 'year' ? 12 : 1;
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + months);
    const { payload, signature } = signLocalWebhook(this.secret, {
      type: 'checkout_completed',
      clientReference: purchase.subscriptionId,
      schoolId: purchase.schoolId,
      externalId: `local_sub_${randomUUID()}`,
      planId: purchase.planId,
      quantity: purchase.quantity,
      currentPeriodEnd: periodEnd,
    });
    const response = await this.fetchFn(new URL('/api/billing/webhook', this.appUrl).toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [LocalCheckoutSimulator.signatureHeader]: signature,
      },
      body: payload,
    });
    return response.ok ? ok(null) : err('webhook_rejected');
  }
}
