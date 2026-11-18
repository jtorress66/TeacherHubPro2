import {
  canEarnFreeMonth,
  canInvite,
  decideReferral,
  freeMonthFor,
  inviteSummary,
  isReferralCode,
  joinReferral,
  maxFreeMonthsPerYear,
  ok,
  referralCodeFrom,
  type InviteSummary,
  type ReferralCode,
  type ReferralId,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type {
  BillingRewards,
  Clock,
  IdGenerator,
  RandomTokenGenerator,
  ReferralRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';

/** A clash of random codes is a one-in-a-trillion event; three in a row means a broken generator. */
const codeAttempts = 3;

async function ensureCode(
  deps: { readonly referrals: ReferralRepository; readonly tokens: RandomTokenGenerator },
  actor: User,
): Promise<ReferralCode> {
  for (let attempt = 0; attempt < codeAttempts; attempt += 1) {
    const existing = await deps.referrals.findCodeOf(actor.schoolId, actor.id);
    if (existing !== null) return existing;
    const code = {
      code: referralCodeFrom(deps.tokens.generate()),
      userId: actor.id,
      schoolId: actor.schoolId,
    };
    if (await deps.referrals.addCode(code)) return code;
  }
  throw new Error('could not make a unique invite code');
}

export interface InvitePage extends InviteSummary {
  readonly code: string;
  readonly maxFreeMonths: number;
}

export interface GetInvitePageDeps {
  readonly referrals: ReferralRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly tokens: RandomTokenGenerator;
  readonly clock: Clock;
}

/** The teacher's invite link code and how many colleagues joined and free months it earned. */
export class GetInvitePage {
  constructor(private readonly deps: GetInvitePageDeps) {}

  /** Whether the menu shows the invite page: owners of individual accounts only. */
  async isOpenTo(actor: User): Promise<boolean> {
    const subscription = await findSchoolSubscription(this.deps.subscriptions, actor.schoolId);
    return canInvite(subscription, actor.id);
  }

  async execute(input: { readonly actor: User }): Promise<Result<InvitePage, UseCaseError>> {
    const { actor } = input;
    if (!(await this.isOpenTo(actor))) return fail('forbidden');
    const code = await ensureCode(this.deps, actor);
    const referrals = await this.deps.referrals.listForReferrer(actor.schoolId, actor.id);
    return ok({
      code: code.code,
      maxFreeMonths: maxFreeMonthsPerYear,
      ...inviteSummary(referrals, this.deps.clock.now()),
    });
  }
}

export interface RecordReferralDeps {
  readonly referrals: ReferralRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Notes who invited a new account; an unknown or badly typed code is simply ignored. */
export async function recordReferral(
  deps: RecordReferralDeps,
  referralCode: string | null | undefined,
  invitedSchoolId: SchoolId,
): Promise<void> {
  if (!isReferralCode(referralCode)) return;
  const code = await deps.referrals.findCode(referralCode);
  if (code === null) return;
  await deps.referrals.save(
    joinReferral({
      id: deps.ids.next() as ReferralId,
      code,
      invitedSchoolId,
      now: deps.clock.now(),
    }),
  );
}

export interface RewardReferrerDeps {
  readonly referrals: ReferralRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly billingRewards: BillingRewards;
  readonly clock: Clock;
}

/**
 * At an invited school's first payment, gives the inviter a free month, within the yearly limit.
 * Decided once; when the payment provider cannot give it, nothing is decided and the caller retries.
 */
export class RewardReferrer {
  constructor(private readonly deps: RewardReferrerDeps) {}

  async afterPayment(invitedSchoolId: SchoolId): Promise<Result<null, UseCaseError>> {
    const referral = await this.deps.referrals.findByInvitedSchool(invitedSchoolId);
    if (referral?.status !== 'joined') return ok(null);
    const now = this.deps.clock.now();
    const earned = await this.deps.referrals.listForReferrer(
      referral.referrerSchoolId,
      referral.referrerId,
    );
    const subscription = await findSchoolSubscription(
      this.deps.subscriptions,
      referral.referrerSchoolId,
    );
    const freeMonth = canEarnFreeMonth(earned, now)
      ? freeMonthFor(subscription, referral.referrerId, now)
      : null;
    if (freeMonth?.kind === 'trial') await this.deps.subscriptions.save(freeMonth.subscription);
    if (freeMonth?.kind === 'provider') {
      const delayed = await this.deps.billingRewards.delayNextCharge(
        freeMonth.externalId,
        freeMonth.until,
      );
      if (!delayed.ok) return fail('billing_failed');
    }
    await this.deps.referrals.save(decideReferral(referral, freeMonth !== null, now));
    return ok(null);
  }
}
