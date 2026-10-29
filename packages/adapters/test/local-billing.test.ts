import { describe, expect, it } from 'vitest';
import type { Email, SchoolId, SubscriptionId } from '@thp/domain';
import { billingEventsContract, checkoutSessionsContract } from '@thp/testing';
import {
  LocalBillingEvents,
  LocalCheckoutSessions,
  LocalCheckoutSimulator,
  signLocalWebhook,
} from '../src/billing/local-billing.ts';

const secret = 'local-billing-secret-for-tests';
const bodyText = (body: RequestInit['body']): string => (typeof body === 'string' ? body : '');

checkoutSessionsContract('LocalCheckoutSessions', {
  working: () => new LocalCheckoutSessions('https://app.test'),
});

billingEventsContract('LocalBillingEvents', {
  make: () => new LocalBillingEvents(secret),
  sign: (event) => signLocalWebhook(secret, event),
  unsupportedPayload: () => signLocalWebhook(secret, { type: 'local.ignored' }),
});

describe('LocalCheckoutSessions', () => {
  it('sends the teacher to the in-app test checkout with everything it needs', async () => {
    const result = await new LocalCheckoutSessions('https://app.test').createCheckout({
      planId: 'school',
      quantity: 12,
      customerEmail: 'ana@school.edu' as Email,
      clientReference: 'sub-1' as SubscriptionId,
      schoolId: 'school-1' as SchoolId,
      trialEnd: null,
      successUrl: 'https://app.test/es/app/billing?checkout=success',
      cancelUrl: 'https://app.test/es/app/billing?checkout=canceled',
    });

    const url = new URL(result.ok ? result.value.url : '');
    expect(url.pathname).toBe('/billing/local-checkout');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      plan: 'school',
      quantity: '12',
      subscription: 'sub-1',
      school: 'school-1',
      email: 'ana@school.edu',
      success: 'https://app.test/es/app/billing?checkout=success',
      cancel: 'https://app.test/es/app/billing?checkout=canceled',
    });
  });
});

describe('LocalCheckoutSimulator', () => {
  const purchase = {
    subscriptionId: 'sub-1' as SubscriptionId,
    schoolId: 'school-1' as SchoolId,
    planId: 'school' as const,
    quantity: 12,
  };

  it('plays the payment provider: posts a signed checkout_completed webhook to the app', async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const simulator = new LocalCheckoutSimulator(
      'https://app.test',
      secret,
      (url, init) => {
        sent.push({ url, init });
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
      () => new Date('2026-09-01T00:00:00Z'),
    );

    expect(await simulator.pay(purchase)).toEqual({ ok: true, value: null });

    const [request] = sent;
    expect(request?.url).toBe('https://app.test/api/billing/webhook');
    const headers = new Headers(request?.init.headers);
    const parsed = new LocalBillingEvents(secret).parseWebhook(
      bodyText(request?.init.body),
      headers.get(LocalCheckoutSimulator.signatureHeader) ?? '',
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        type: 'checkout_completed',
        clientReference: 'sub-1',
        schoolId: 'school-1',
        planId: 'school',
        quantity: 12,
        currentPeriodEnd: new Date('2027-09-01T00:00:00Z'),
      },
    });
  });

  it('bills monthly plans for a month', async () => {
    let body = '';
    const simulator = new LocalCheckoutSimulator(
      'https://app.test',
      secret,
      (_url, init) => {
        body = bodyText(init.body);
        return Promise.resolve(new Response('{}'));
      },
      () => new Date('2026-09-01T00:00:00Z'),
    );
    await simulator.pay({ ...purchase, planId: 'individual_monthly', quantity: 1 });

    expect(JSON.parse(body)).toMatchObject({ currentPeriodEnd: '2026-10-01T00:00:00.000Z' });
  });

  it('reports when the app rejects the webhook', async () => {
    const simulator = new LocalCheckoutSimulator('https://app.test', secret, () =>
      Promise.resolve(new Response('{}', { status: 400 })),
    );

    expect(await simulator.pay(purchase)).toEqual({ ok: false, error: 'webhook_rejected' });
  });
});
