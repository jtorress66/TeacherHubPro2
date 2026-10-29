import { describe, expect, it } from 'vitest';
import { stripePriceFor } from '../../src/billing/stripe-plans.ts';
import { ensureStripePrices } from '../../src/billing/stripe-setup.ts';
import { fakeStripe, on, recorded } from './fake-stripe.ts';

describe('stripePriceFor', () => {
  it('prices each plan per billing period from the plan catalog', () => {
    expect(stripePriceFor('individual_monthly')).toMatchObject({
      lookupKey: 'thp_individual_monthly',
      unitAmount: 999,
      interval: 'month',
    });
    expect(stripePriceFor('individual_yearly')).toMatchObject({
      lookupKey: 'thp_individual_yearly',
      unitAmount: 7900,
      interval: 'year',
    });
    expect(stripePriceFor('school')).toMatchObject({
      lookupKey: 'thp_school_seat_yearly',
      unitAmount: 7200,
      interval: 'year',
    });
    expect(stripePriceFor('district')).toMatchObject({
      lookupKey: 'thp_district_seat_yearly',
      unitAmount: 4800,
      interval: 'year',
    });
  });
});

describe('ensureStripePrices', () => {
  it('creates the products and prices that are missing and keeps the ones that exist', async () => {
    const { stripe, requests } = fakeStripe([
      on('GET', '/v1/prices', (request) =>
        request.params.get('lookup_keys[0]') === 'thp_school_seat_yearly'
          ? { body: recorded('prices-list') }
          : { body: { object: 'list', url: '/v1/prices', has_more: false, data: [] } },
      ),
      on('POST', '/v1/products', { body: recorded('product') }),
      on('POST', '/v1/prices', { body: recorded('price') }),
    ]);

    const result = await ensureStripePrices(stripe);

    expect(result).toEqual({
      ok: true,
      value: [
        { planId: 'individual_monthly', priceId: 'price_New', created: true },
        { planId: 'individual_yearly', priceId: 'price_New', created: true },
        { planId: 'school', priceId: 'price_1SchoolSeatYearly', created: false },
        { planId: 'district', priceId: 'price_New', created: true },
      ],
    });
    const priceCreations = requests.filter((r) => r.method === 'POST' && r.path === '/v1/prices');
    expect(Object.fromEntries(priceCreations[0]?.params ?? [])).toMatchObject({
      lookup_key: 'thp_individual_monthly',
      unit_amount: '999',
      currency: 'usd',
      'recurring[interval]': 'month',
      product: 'prod_New',
    });
  });

  it('reports a Stripe failure', async () => {
    const { stripe } = fakeStripe([
      on('GET', '/v1/prices', { status: 500, body: recorded('api-error') }),
    ]);

    expect(await ensureStripePrices(stripe)).toEqual({
      ok: false,
      error: 'An unknown error occurred.',
    });
  });
});
