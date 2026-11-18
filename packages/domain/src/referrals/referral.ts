import { planCatalog } from '../billing/plan-catalog.ts';
import { extendTrial, type Subscription } from '../billing/subscription.ts';
import type { ReferralId, SchoolId, UserId } from '../shared/ids.ts';

/** Capitals and digits without the ones people misread (I, L, O, 0, 1). */
const codeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codeLength = 8;
const codePattern = /^[A-HJKMNP-Z2-9]{8}$/;

/** A teacher's free month for each colleague who joins through their link and pays. */
export const freeMonthDays = 30;
/** Free months stay a small cost: at most three in any 365 days. */
export const maxFreeMonthsPerYear = 3;

const dayMs = 24 * 60 * 60 * 1000;
const yearMs = 365 * dayMs;

/** A teacher's personal invite code, made once and kept. */
export interface ReferralCode {
  readonly code: string;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
}

export const referralStatuses = ['joined', 'rewarded', 'not_rewarded'] as const;

export type ReferralStatus = (typeof referralStatuses)[number];

/** A colleague who made an account through someone's link; decided at their first payment. */
export interface Referral {
  readonly id: ReferralId;
  readonly referrerId: UserId;
  readonly referrerSchoolId: SchoolId;
  readonly invitedSchoolId: SchoolId;
  readonly joinedAt: Date;
  readonly status: ReferralStatus;
  readonly decidedAt: Date | null;
}

/** Eight readable characters from a random token; every character of the token counts. */
export function referralCodeFrom(token: string): string {
  let code = '';
  for (let position = 0; position < codeLength; position += 1) {
    let hash = 0x811c9dc5 ^ position;
    for (let i = 0; i < token.length; i += 1) {
      hash = Math.imul(hash ^ token.charCodeAt(i), 0x01000193) >>> 0;
    }
    code += codeAlphabet[hash % codeAlphabet.length] ?? '';
  }
  return code;
}

export const isReferralCode = (value: unknown): value is string =>
  typeof value === 'string' && codePattern.test(value);

export function joinReferral(input: {
  readonly id: ReferralId;
  readonly code: ReferralCode;
  readonly invitedSchoolId: SchoolId;
  readonly now: Date;
}): Referral {
  return {
    id: input.id,
    referrerId: input.code.userId,
    referrerSchoolId: input.code.schoolId,
    invitedSchoolId: input.invitedSchoolId,
    joinedAt: input.now,
    status: 'joined',
    decidedAt: null,
  };
}

export function decideReferral(referral: Referral, rewarded: boolean, now: Date): Referral {
  return { ...referral, status: rewarded ? 'rewarded' : 'not_rewarded', decidedAt: now };
}

const earnedInLastYear = (referrals: readonly Referral[], now: Date): number =>
  referrals.filter(
    (r) =>
      r.status === 'rewarded' &&
      r.decidedAt !== null &&
      now.getTime() - r.decidedAt.getTime() < yearMs,
  ).length;

export function canEarnFreeMonth(referrals: readonly Referral[], now: Date): boolean {
  return earnedInLastYear(referrals, now) < maxFreeMonthsPerYear;
}

export interface InviteSummary {
  readonly joined: number;
  readonly freeMonths: number;
  readonly limitReached: boolean;
}

export function inviteSummary(referrals: readonly Referral[], now: Date): InviteSummary {
  return {
    joined: referrals.length,
    freeMonths: referrals.filter((r) => r.status === 'rewarded').length,
    limitReached: !canEarnFreeMonth(referrals, now),
  };
}

const isOwnIndividualAccount = (subscription: Subscription | null, userId: UserId) =>
  subscription !== null &&
  subscription.ownerId === userId &&
  planCatalog[subscription.planId].unit === 'account';

/** Owners of individual accounts invite; on School and District plans the school pays. */
export function canInvite(subscription: Subscription | null, userId: UserId): boolean {
  return isOwnIndividualAccount(subscription, userId) && subscription?.status !== 'canceled';
}

export type FreeMonth =
  | { readonly kind: 'trial'; readonly subscription: Subscription }
  | { readonly kind: 'provider'; readonly externalId: string; readonly until: Date };

/**
 * How the inviter gets their free month: 30 more trial days, or the payment provider's next charge
 * moved 30 days later. Null when there is nothing to give it to (canceled, overdue, a school plan).
 */
export function freeMonthFor(
  subscription: Subscription | null,
  referrerId: UserId,
  now: Date,
): FreeMonth | null {
  if (subscription === null || !isOwnIndividualAccount(subscription, referrerId)) return null;
  if (subscription.status === 'active' && subscription.externalId !== null) {
    const from = Math.max(subscription.currentPeriodEnd?.getTime() ?? 0, now.getTime());
    return {
      kind: 'provider',
      externalId: subscription.externalId,
      until: new Date(from + freeMonthDays * dayMs),
    };
  }
  const extended = extendTrial(subscription, freeMonthDays, now);
  return extended.ok ? { kind: 'trial', subscription: extended.value } : null;
}
