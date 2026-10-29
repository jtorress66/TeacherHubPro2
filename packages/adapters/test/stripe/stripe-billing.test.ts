import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import type { Email, SchoolId, SubscriptionId } from '@thp/domain';
import type { BillingEvent, CheckoutRequest } from '@thp/ports';
import { billingEventsContract, checkoutSessionsContract } from '@thp/testing';
import { StripeBillingEvents } from '../../src/billing/stripe-billing-events.ts';
import { StripeCheckoutSessions } from '../../src/billing/stripe-checkout-sessions.ts';
import { fakeStripe, on, recorded } from './fake-stripe.ts';

const webhookSecret = 'whsec_test_recorded';
const now = new Date('2026-09-01T08:00:00Z');

const workingStripe = () =>
  fakeStripe([
    on('GET', '/v1/prices', { body: recorded('prices-list') }),
    on('POST', '/v1/checkout/sessions', { body: recorded('checkout-session') }),
  ]);

checkoutSessionsContract('StripeCheckoutSessions', {
  working: () => new StripeCheckoutSessions(workingStripe().stripe, () => now),
  failing: () =>
    new StripeCheckoutSessions(
      fakeStripe([on('GET', '/v1/prices', { status: 500, body: recorded('api-error') })]).stripe,
    ),
});

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

/** The Stripe event that carries each of our billing events. */
function stripeEventFor(event: BillingEvent): object {
  const subscription = (status: string, extra: object = {}) => ({
    id: event.externalId,
    object: 'subscription',
    status,
    metadata: {},
    items: { object: 'list', data: [] },
    ...extra,
  });
  const period = (end: Date) => ({
    items: { object: 'list', data: [{ current_period_end: unix(end) }] },
  });
  const wrap = (type: string, object: object) => ({
    id: 'evt_test',
    object: 'event',
    type,
    data: { object },
  });

  switch (event.type) {
    case 'checkout_completed':
      return wrap(
        'customer.subscription.created',
        subscription('trialing', {
          metadata: {
            schoolId: event.schoolId,
            subscriptionId: event.clientReference,
            planId: event.planId,
            quantity: String(event.quantity),
          },
          ...period(event.currentPeriodEnd),
        }),
      );
    case 'renewed':
      return wrap(
        'customer.subscription.updated',
        subscription('active', period(event.currentPeriodEnd)),
      );
    case 'payment_failed':
      return wrap('customer.subscription.updated', subscription('past_due'));
    case 'canceled':
      return wrap('customer.subscription.deleted', subscription('canceled'));
  }
}

const sign = (payload: object) => {
  const text = JSON.stringify(payload);
  return {
    payload: text,
    signature: Stripe.webhooks.generateTestHeaderString({ payload: text, secret: webhookSecret }),
  };
};

billingEventsContract('StripeBillingEvents', {
  make: () => new StripeBillingEvents(workingStripe().stripe, webhookSecret),
  sign: (event) => sign(stripeEventFor(event)),
  unsupportedPayload: () =>
    sign({ id: 'evt_test', object: 'event', type: 'invoice.created', data: { object: {} } }),
});

const request: CheckoutRequest = {
  planId: 'school',
  quantity: 12,
  customerEmail: 'admin@school.edu' as Email,
  clientReference: 'sub-1' as SubscriptionId,
  schoolId: 'school-1' as SchoolId,
  trialEnd: new Date('2026-09-08T08:00:00Z'),
  successUrl: 'https://app.test/es/app/billing?checkout=success',
  cancelUrl: 'https://app.test/es/app/billing?checkout=canceled',
};

describe('StripeCheckoutSessions', () => {
  it('opens a subscription checkout for the plan price and seats, tagged with our ids', async () => {
    const { stripe, requests } = workingStripe();

    const result = await new StripeCheckoutSessions(stripe, () => now).createCheckout(request);

    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: 'cs_test_a1B2c3',
        url: 'https://checkout.stripe.com/c/pay/cs_test_a1B2c3',
      },
    });
    expect(requests[0]?.params.get('lookup_keys[0]')).toBe('thp_school_seat_yearly');
    const created = Object.fromEntries(requests[1]?.params ?? []);
    expect(created).toMatchObject({
      mode: 'subscription',
      'line_items[0][price]': 'price_1SchoolSeatYearly',
      'line_items[0][quantity]': '12',
      customer_email: 'admin@school.edu',
      client_reference_id: 'sub-1',
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      'subscription_data[trial_end]': String(unix(new Date('2026-09-08T08:00:00Z'))),
      'subscription_data[metadata][schoolId]': 'school-1',
      'subscription_data[metadata][subscriptionId]': 'sub-1',
      'subscription_data[metadata][planId]': 'school',
      'subscription_data[metadata][quantity]': '12',
    });
  });

  it('charges at once when the free trial ends in less than 48 hours, as Stripe requires', async () => {
    const { stripe, requests } = workingStripe();
    const soon = { ...request, trialEnd: new Date(now.getTime() + 47 * 3600 * 1000) };

    await new StripeCheckoutSessions(stripe, () => now).createCheckout(soon);
    await new StripeCheckoutSessions(stripe, () => now).createCheckout({
      ...request,
      trialEnd: null,
    });

    expect(requests[1]?.params.has('subscription_data[trial_end]')).toBe(false);
    expect(requests[3]?.params.has('subscription_data[trial_end]')).toBe(false);
  });

  it('reports a plan whose price has not been set up in Stripe', async () => {
    const { stripe } = fakeStripe([
      on('GET', '/v1/prices', {
        body: { object: 'list', url: '/v1/prices', has_more: false, data: [] },
      }),
    ]);

    expect(await new StripeCheckoutSessions(stripe).createCheckout(request)).toEqual({
      ok: false,
      error: { code: 'invalid_request' },
    });
  });

  it('maps a request Stripe refuses to invalid_request', async () => {
    const { stripe } = fakeStripe([
      on('GET', '/v1/prices', { body: recorded('prices-list') }),
      on('POST', '/v1/checkout/sessions', { status: 400, body: recorded('invalid-request') }),
    ]);

    expect(await new StripeCheckoutSessions(stripe).createCheckout(request)).toEqual({
      ok: false,
      error: { code: 'invalid_request' },
    });
  });

  it('treats a session without a payment page as unavailable', async () => {
    const { stripe } = fakeStripe([
      on('GET', '/v1/prices', { body: recorded('prices-list') }),
      on('POST', '/v1/checkout/sessions', {
        body: { id: 'cs_test_x', object: 'checkout.session', url: null },
      }),
    ]);

    expect(await new StripeCheckoutSessions(stripe).createCheckout(request)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});

describe('StripeBillingEvents', () => {
  const events = () => new StripeBillingEvents(workingStripe().stripe, webhookSecret);

  it('falls back to the trial end when the subscription has no period end yet', () => {
    const { payload, signature } = sign({
      id: 'evt_test',
      object: 'event',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_x',
          object: 'subscription',
          status: 'trialing',
          trial_end: unix(new Date('2026-09-08T08:00:00Z')),
          metadata: {
            schoolId: 's1',
            subscriptionId: 'sub-1',
            planId: 'individual_monthly',
            quantity: '1',
          },
          items: { object: 'list', data: [] },
        },
      },
    });

    expect(events().parseWebhook(payload, signature)).toMatchObject({
      ok: true,
      value: { type: 'checkout_completed', currentPeriodEnd: new Date('2026-09-08T08:00:00Z') },
    });
  });

  it('ignores subscriptions created outside our checkout (no or bad metadata) and states we do not handle', () => {
    const created = (metadata: object, status = 'active') =>
      sign({
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_x',
            object: 'subscription',
            status,
            metadata,
            items: { object: 'list', data: [{ current_period_end: 1 }] },
          },
        },
      });
    const unsupported = { ok: false, error: { code: 'unsupported_event' } };

    const noMetadata = created({});
    expect(events().parseWebhook(noMetadata.payload, noMetadata.signature)).toEqual(unsupported);
    const badPlan = created({ schoolId: 's', subscriptionId: 'x', planId: 'gold', quantity: '1' });
    expect(events().parseWebhook(badPlan.payload, badPlan.signature)).toEqual(unsupported);
    const noPeriod = sign({
      id: 'evt_test',
      object: 'event',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_x',
          object: 'subscription',
          status: 'active',
          metadata: { schoolId: 's', subscriptionId: 'x', planId: 'school', quantity: '10' },
          items: { object: 'list', data: [] },
          trial_end: null,
        },
      },
    });
    expect(events().parseWebhook(noPeriod.payload, noPeriod.signature)).toEqual(unsupported);
    const paused = sign({
      id: 'evt_test',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_x',
          object: 'subscription',
          status: 'paused',
          metadata: {},
          items: { object: 'list', data: [] },
        },
      },
    });
    expect(events().parseWebhook(paused.payload, paused.signature)).toEqual(unsupported);
  });

  it('treats an unpaid subscription as a failed payment', () => {
    const { payload, signature } = sign({
      id: 'evt_test',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_x',
          object: 'subscription',
          status: 'unpaid',
          metadata: {},
          items: { object: 'list', data: [] },
        },
      },
    });

    expect(events().parseWebhook(payload, signature)).toEqual({
      ok: true,
      value: { type: 'payment_failed', externalId: 'sub_x' },
    });
  });
});
