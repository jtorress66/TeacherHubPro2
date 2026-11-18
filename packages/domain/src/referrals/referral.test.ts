import { describe, expect, it } from 'vitest';
import type { Subscription } from '../billing/subscription.ts';
import type { ReferralId, SchoolId, SubscriptionId, UserId } from '../shared/ids.ts';
import {
  canEarnFreeMonth,
  canInvite,
  decideReferral,
  freeMonthDays,
  freeMonthFor,
  inviteSummary,
  isReferralCode,
  joinReferral,
  maxFreeMonthsPerYear,
  referralCodeFrom,
  type Referral,
  type ReferralCode,
} from './referral.ts';

const now = new Date('2026-11-17T12:00:00Z');
const day = 24 * 60 * 60 * 1000;
const referrerId = 'user-1' as UserId;

const code: ReferralCode = {
  code: 'K7M2QX9P',
  userId: referrerId,
  schoolId: 'school-1' as SchoolId,
};

const subscription = (changes: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1' as SubscriptionId,
  schoolId: 'school-1' as SchoolId,
  ownerId: referrerId,
  planId: 'individual_monthly',
  quantity: 1,
  status: 'trialing',
  trialEndsAt: new Date(now.getTime() + 3 * day),
  currentPeriodEnd: null,
  externalId: null,
  ...changes,
});

const referral = (n: number, changes: Partial<Referral> = {}): Referral => ({
  ...joinReferral({
    id: `ref-${String(n)}` as ReferralId,
    code,
    invitedSchoolId: `school-${String(n + 10)}` as SchoolId,
    now,
  }),
  ...changes,
});

const rewardedDaysAgo = (n: number, days: number) =>
  referral(n, { status: 'rewarded', decidedAt: new Date(now.getTime() - days * day) });

describe('referral codes', () => {
  it('turns a random token into 8 easy-to-read capitals and digits', () => {
    const made = referralCodeFrom('token-00000000000000000000000000000001');

    expect(made).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(isReferralCode(made)).toBe(true);
  });

  it('gives different tokens different codes', () => {
    expect(referralCodeFrom('aB3-_xYz9')).not.toBe(referralCodeFrom('aB3-_xYz8'));
  });

  it('refuses anything that is not a code, including confusable letters', () => {
    expect(isReferralCode('K7M2QX9')).toBe(false);
    expect(isReferralCode('K7M2QX9PP')).toBe(false);
    expect(isReferralCode('k7m2qx9p')).toBe(false);
    expect(isReferralCode('K7M2QX0P')).toBe(false);
    expect(isReferralCode(null)).toBe(false);
  });
});

describe('joining through a link', () => {
  it('records the inviter and the new school, not yet decided', () => {
    expect(referral(1)).toEqual({
      id: 'ref-1',
      referrerId,
      referrerSchoolId: 'school-1',
      invitedSchoolId: 'school-11',
      joinedAt: now,
      status: 'joined',
      decidedAt: null,
    });
  });

  it('is decided once: rewarded or not', () => {
    expect(decideReferral(referral(1), true, now)).toMatchObject({
      status: 'rewarded',
      decidedAt: now,
    });
    expect(decideReferral(referral(1), false, now).status).toBe('not_rewarded');
  });
});

describe('the yearly limit', () => {
  it('is three free months a year', () => {
    expect(maxFreeMonthsPerYear).toBe(3);
    expect(freeMonthDays).toBe(30);
  });

  it('allows a free month until three were earned in the last 365 days', () => {
    expect(canEarnFreeMonth([rewardedDaysAgo(1, 10), rewardedDaysAgo(2, 20)], now)).toBe(true);
    expect(
      canEarnFreeMonth(
        [rewardedDaysAgo(1, 10), rewardedDaysAgo(2, 20), rewardedDaysAgo(3, 30)],
        now,
      ),
    ).toBe(false);
  });

  it('counts only free months earned, and only in the last year', () => {
    const older = [rewardedDaysAgo(1, 366), rewardedDaysAgo(2, 400), rewardedDaysAgo(3, 500)];
    const notEarned = [1, 2, 3].map((n) => referral(n, { status: 'not_rewarded', decidedAt: now }));

    expect(canEarnFreeMonth([...older, ...notEarned, referral(9)], now)).toBe(true);
  });

  it('sums up joined colleagues and free months earned', () => {
    const all = [rewardedDaysAgo(1, 400), rewardedDaysAgo(2, 10), referral(3)];

    expect(inviteSummary(all, now)).toEqual({
      joined: 3,
      freeMonths: 2,
      limitReached: false,
    });
    expect(
      inviteSummary([rewardedDaysAgo(1, 1), rewardedDaysAgo(2, 2), rewardedDaysAgo(3, 3)], now)
        .limitReached,
    ).toBe(true);
  });
});

describe('who can invite', () => {
  it('is the owner of an individual account, on trial or paying', () => {
    expect(canInvite(subscription(), referrerId)).toBe(true);
    expect(canInvite(subscription({ status: 'expired' }), referrerId)).toBe(true);
    expect(canInvite(subscription({ status: 'active', externalId: 'sub_x' }), referrerId)).toBe(
      true,
    );
    expect(canInvite(subscription({ planId: 'individual_yearly' }), referrerId)).toBe(true);
  });

  it('is not a teacher on a school or district plan, nor someone else', () => {
    expect(canInvite(subscription({ planId: 'school', quantity: 10 }), referrerId)).toBe(false);
    expect(canInvite(subscription({ planId: 'district', quantity: 100 }), referrerId)).toBe(false);
    expect(canInvite(subscription(), 'user-2' as UserId)).toBe(false);
    expect(canInvite(null, referrerId)).toBe(false);
  });
});

describe('how a free month is given', () => {
  it('adds 30 days to a trial', () => {
    const given = freeMonthFor(subscription(), referrerId, now);

    expect(given).toEqual({
      kind: 'trial',
      subscription: subscription({ trialEndsAt: new Date(now.getTime() + 33 * day) }),
    });
  });

  it('opens an ended trial again for 30 days from today', () => {
    const ended = subscription({
      status: 'expired',
      trialEndsAt: new Date(now.getTime() - 5 * day),
    });

    expect(freeMonthFor(ended, referrerId, now)).toEqual({
      kind: 'trial',
      subscription: {
        ...ended,
        status: 'trialing',
        trialEndsAt: new Date(now.getTime() + 30 * day),
      },
    });
  });

  it('moves a paying account’s next charge 30 days later', () => {
    const periodEnd = new Date(now.getTime() + 12 * day);
    const paying = subscription({
      status: 'active',
      externalId: 'sub_x',
      currentPeriodEnd: periodEnd,
    });

    expect(freeMonthFor(paying, referrerId, now)).toEqual({
      kind: 'provider',
      externalId: 'sub_x',
      until: new Date(periodEnd.getTime() + 30 * day),
    });
  });

  it('gives nothing to a canceled or overdue account, a school plan or someone else', () => {
    expect(freeMonthFor(subscription({ status: 'canceled' }), referrerId, now)).toBeNull();
    expect(
      freeMonthFor(subscription({ status: 'past_due', externalId: 'sub_x' }), referrerId, now),
    ).toBeNull();
    expect(
      freeMonthFor(subscription({ planId: 'school', quantity: 10 }), referrerId, now),
    ).toBeNull();
    expect(freeMonthFor(subscription(), 'user-2' as UserId, now)).toBeNull();
    expect(freeMonthFor(null, referrerId, now)).toBeNull();
  });
});
