import { describe, expect, it } from 'vitest';
import { activateSubscription } from '@thp/domain';
import { aSubscription, unwrap } from '@thp/testing';
import {
  planBadge,
  planPrice as rawPlanPrice,
  totalPrice as rawTotalPrice,
} from './plan-display.ts';

/** Intl puts a non-breaking space between amount and currency in some languages. */
const nonBreakingSpace = String.fromCharCode(160);
const plain = (text: string) => text.replaceAll(nonBreakingSpace, ' ');
const planPrice = (...args: Parameters<typeof rawPlanPrice>) => plain(rawPlanPrice(...args));
const totalPrice = (...args: Parameters<typeof rawTotalPrice>) => plain(rawTotalPrice(...args));

describe('planPrice', () => {
  it('shows each plan price in the page language', () => {
    expect(planPrice('individual_monthly', 'en')).toBe('$9.99 per month');
    expect(planPrice('individual_yearly', 'en')).toBe('$79.00 per year');
    expect(planPrice('school', 'en')).toBe('$6.00 per teacher per month, billed yearly');
    expect(planPrice('district', 'es')).toBe('4,00 US$ por maestro al mes, facturado anualmente');
  });
});

describe('totalPrice', () => {
  it('shows what one invoice costs for the seats chosen', () => {
    expect(totalPrice('school', 12, 'en')).toBe('$864.00');
    expect(totalPrice('individual_monthly', 1, 'es')).toBe('9,99 US$');
  });
});

describe('planBadge', () => {
  const trial = aSubscription();
  const periodEnd = new Date('2027-09-01T00:00:00Z');

  it('counts the free days left, with a special message for the last day', () => {
    expect(planBadge(trial, { hasAccess: true, trialDaysLeft: 7 }, 'en')).toBe(
      'Free trial: 7 days left',
    );
    expect(planBadge(trial, { hasAccess: true, trialDaysLeft: 1 }, 'es')).toBe(
      'Prueba gratis: último día',
    );
    expect(planBadge(trial, { hasAccess: false, trialDaysLeft: 0 }, 'en')).toBe('Free trial');
  });

  it('names a paid plan, with the teachers on School and District plans', () => {
    const school = unwrap(
      activateSubscription(trial, { currentPeriodEnd: periodEnd, planId: 'school', quantity: 12 }),
    );
    const individual = unwrap(activateSubscription(trial, { currentPeriodEnd: periodEnd }));

    expect(planBadge(school, { hasAccess: true, trialDaysLeft: null }, 'en')).toBe(
      'School · 12 teachers',
    );
    expect(planBadge(school, { hasAccess: true, trialDaysLeft: null }, 'es')).toBe(
      'Escuela · 12 maestros',
    );
    expect(planBadge(individual, { hasAccess: true, trialDaysLeft: null }, 'en')).toBe(
      'Individual monthly',
    );
  });

  it('shows nothing for a school without a subscription', () => {
    expect(planBadge(null, { hasAccess: false, trialDaysLeft: null }, 'en')).toBe('');
  });
});
