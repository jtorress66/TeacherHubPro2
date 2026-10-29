import { err, ok, type Result, type SubscriptionId } from '@thp/domain';
import type {
  BillingError,
  BillingEvent,
  BillingEventError,
  BillingEvents,
  CheckoutRequest,
  CheckoutSession,
  CheckoutSessions,
} from '@thp/ports';

export class FakeCheckoutSessions implements CheckoutSessions {
  readonly requests: CheckoutRequest[] = [];

  constructor(private readonly options: { readonly fail?: boolean } = {}) {}

  createCheckout(request: CheckoutRequest): Promise<Result<CheckoutSession, BillingError>> {
    if (this.options.fail === true) return Promise.resolve(err({ code: 'unavailable' }));
    this.requests.push(request);
    const sessionId = `cs_test_${String(this.requests.length)}`;
    return Promise.resolve(ok({ sessionId, url: `https://checkout.test/${sessionId}` }));
  }
}

type Payload = Record<string, unknown>;

const isPayload = (value: unknown): value is Payload => typeof value === 'object' && value !== null;
const text = (payload: Payload, key: string): string => String(payload[key]);
const date = (payload: Payload, key: string): Date => new Date(text(payload, key));

const readers: Readonly<Record<BillingEvent['type'], (payload: Payload) => BillingEvent>> = {
  checkout_completed: (p) => ({
    type: 'checkout_completed',
    clientReference: text(p, 'clientReference') as SubscriptionId,
    externalId: text(p, 'externalId'),
    currentPeriodEnd: date(p, 'currentPeriodEnd'),
  }),
  renewed: (p) => ({
    type: 'renewed',
    externalId: text(p, 'externalId'),
    currentPeriodEnd: date(p, 'currentPeriodEnd'),
  }),
  payment_failed: (p) => ({ type: 'payment_failed', externalId: text(p, 'externalId') }),
  canceled: (p) => ({ type: 'canceled', externalId: text(p, 'externalId') }),
};

const isEventType = (value: unknown): value is BillingEvent['type'] =>
  typeof value === 'string' && value in readers;

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Webhooks signed with a fixed test signature, carrying our events as JSON. */
export class FakeBillingEvents implements BillingEvents {
  static readonly signature = 'test-signature';

  static sign(event: BillingEvent): { readonly payload: string; readonly signature: string } {
    return { payload: JSON.stringify(event), signature: FakeBillingEvents.signature };
  }

  parseWebhook(payload: string, signature: string): Result<BillingEvent, BillingEventError> {
    if (signature !== FakeBillingEvents.signature) return err({ code: 'invalid_signature' });
    const parsed = parseJson(payload);
    if (!isPayload(parsed) || !isEventType(parsed.type)) return err({ code: 'unsupported_event' });
    return ok(readers[parsed.type](parsed));
  }
}
