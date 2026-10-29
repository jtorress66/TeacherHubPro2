import { describe, expect, it } from 'vitest';
import { type SchoolId, type SubscriptionId, type UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { chargePerBillingPeriodCents, planCatalog, planIds, trialDays } from './plan-catalog.ts';
import {
  activateSubscription,
  cancelSubscription,
  expireTrial,
  hasAccess,
  markPastDue,
  startTrial,
  type Subscription,
} from './subscription.ts';

const now = new Date('2026-09-01T12:00:00Z');
const day = 24 * 60 * 60 * 1000;
const periodEnd = new Date('2026-10-01T12:00:00Z');
const base = {
  id: 'sub-1' as SubscriptionId,
  schoolId: 'school-1' as SchoolId,
  ownerId: 'user-1' as UserId,
  planId: 'individual_monthly' as const,
  now,
};

const trialing = (): Subscription => valueOf(startTrial(base));
const active = (): Subscription =>
  valueOf(
    activateSubscription(trialing(), { currentPeriodEnd: periodEnd, externalId: 'stripe_sub_1' }),
  );

describe('plan catalog', () => {
  it('the prices match the original app', () => {
    expect(planIds).toEqual(['individual_monthly', 'individual_yearly', 'school', 'district']);
    expect(planCatalog.individual_monthly).toMatchObject({
      priceCents: 999,
      pricePer: 'month',
      billedEvery: 'month',
      unit: 'account',
    });
    expect(planCatalog.individual_yearly).toMatchObject({
      priceCents: 7900,
      pricePer: 'year',
      billedEvery: 'year',
      unit: 'account',
    });
    expect(planCatalog.school).toMatchObject({
      priceCents: 600,
      pricePer: 'month',
      billedEvery: 'year',
      unit: 'teacher',
    });
    expect(planCatalog.district).toMatchObject({
      priceCents: 400,
      pricePer: 'month',
      billedEvery: 'year',
      unit: 'teacher',
    });
  });

  it('offers a 7-day free trial', () => {
    expect(trialDays).toBe(7);
  });

  it('charges school and district plans per teacher for a year', () => {
    expect(chargePerBillingPeriodCents('individual_monthly', 1)).toBe(999);
    expect(chargePerBillingPeriodCents('individual_yearly', 1)).toBe(7900);
    expect(chargePerBillingPeriodCents('school', 10)).toBe(72000);
    expect(chargePerBillingPeriodCents('district', 100)).toBe(480000);
  });
});

describe('startTrial', () => {
  it('a trial lasts 7 days', () => {
    expect(trialing()).toEqual({
      id: base.id,
      schoolId: base.schoolId,
      ownerId: base.ownerId,
      planId: 'individual_monthly',
      quantity: 1,
      status: 'trialing',
      trialEndsAt: new Date(now.getTime() + 7 * day),
      currentPeriodEnd: null,
      externalId: null,
    });
  });

  it('individual plans have one seat; school plans need at least one whole teacher', () => {
    expect(errorOf(startTrial({ ...base, quantity: 2 }))).toEqual({
      field: 'quantity',
      code: 'out_of_range',
    });
    expect(valueOf(startTrial({ ...base, planId: 'school', quantity: 25 })).quantity).toBe(25);
    for (const quantity of [0, 1.5]) {
      expect(errorOf(startTrial({ ...base, planId: 'district', quantity }))).toEqual({
        field: 'quantity',
        code: 'out_of_range',
      });
    }
  });
});

describe('subscription state machine', () => {
  it('trialing → active', () => {
    expect(active()).toMatchObject({
      status: 'active',
      currentPeriodEnd: periodEnd,
      externalId: 'stripe_sub_1',
    });
  });

  it('active → past_due → active keeps the existing external id when none is given', () => {
    const pastDue = valueOf(markPastDue(active()));
    expect(pastDue.status).toBe('past_due');

    const renewed = valueOf(activateSubscription(pastDue, { currentPeriodEnd: periodEnd }));
    expect(renewed).toMatchObject({ status: 'active', externalId: 'stripe_sub_1' });
  });

  it('can be canceled while trialing, active or past due', () => {
    expect(valueOf(cancelSubscription(trialing())).status).toBe('canceled');
    expect(valueOf(cancelSubscription(active())).status).toBe('canceled');
    expect(valueOf(cancelSubscription(valueOf(markPastDue(active())))).status).toBe('canceled');
  });

  it('a trial expires only once its 7 days are over', () => {
    expect(errorOf(expireTrial(trialing(), new Date(now.getTime() + 6 * day)))).toEqual({
      code: 'trial_not_over',
    });
    expect(valueOf(expireTrial(trialing(), new Date(now.getTime() + 7 * day))).status).toBe(
      'expired',
    );
  });

  it('forbidden transitions return an error', () => {
    const canceled = valueOf(cancelSubscription(active()));
    const expired = valueOf(expireTrial(trialing(), new Date(now.getTime() + 8 * day)));

    expect(errorOf(activateSubscription(canceled, { currentPeriodEnd: periodEnd }))).toEqual({
      code: 'invalid_transition',
      from: 'canceled',
      action: 'activate',
    });
    expect(errorOf(markPastDue(trialing()))).toEqual({
      code: 'invalid_transition',
      from: 'trialing',
      action: 'mark_past_due',
    });
    expect(errorOf(cancelSubscription(expired))).toEqual({
      code: 'invalid_transition',
      from: 'expired',
      action: 'cancel',
    });
    expect(errorOf(expireTrial(active(), now))).toEqual({
      code: 'invalid_transition',
      from: 'active',
      action: 'expire_trial',
    });
    expect(errorOf(activateSubscription(active(), { currentPeriodEnd: periodEnd }))).toEqual({
      code: 'invalid_transition',
      from: 'active',
      action: 'activate',
    });
  });
});

describe('hasAccess', () => {
  it('access ends when the trial expires', () => {
    expect(hasAccess(trialing(), new Date(now.getTime() + 6 * day))).toBe(true);
    expect(hasAccess(trialing(), new Date(now.getTime() + 7 * day))).toBe(false);
  });

  it('active and past-due subscriptions keep access; canceled and expired do not', () => {
    expect(hasAccess(active(), now)).toBe(true);
    expect(hasAccess(valueOf(markPastDue(active())), now)).toBe(true);
    expect(hasAccess(valueOf(cancelSubscription(active())), now)).toBe(false);
    expect(
      hasAccess(valueOf(expireTrial(trialing(), new Date(now.getTime() + 8 * day))), now),
    ).toBe(false);
  });
});
