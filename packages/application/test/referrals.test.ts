import { describe, expect, it } from 'vitest';
import { cancelSubscription, type SchoolId, type Subscription, type User } from '@thp/domain';
import type { BillingEvent } from '@thp/ports';
import { FakeBillingEvents, unwrap } from '@thp/testing';
import { GetInvitePage, HandleBillingWebhook, SignInWithGoogle, SignUp } from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { makeWorld, signUpInput, signedUp, type World } from './world.ts';

const day = 24 * 60 * 60 * 1000;

const invitePage = (world: World, actor: User) => new GetInvitePage(world).execute({ actor });

/** The inviter's code, made the first time they open the invite page. */
const codeOf = async (world: World, actor: User) => valueOf(await invitePage(world, actor)).code;

/** A colleague who signs up with the email form through the inviter's link. */
async function colleagueJoins(world: World, code: string | null, email = 'ben@school.edu') {
  return valueOf(await new SignUp(world).execute({ ...signUpInput(email), referralCode: code }));
}

const subscriptionOf = async (world: World, schoolId: SchoolId): Promise<Subscription> => {
  const all = await world.subscriptions.listBySchool(schoolId);
  const latest = all.at(-1);
  if (latest === undefined) throw new Error('no subscription');
  return latest;
};

const deliver = (world: World, event: BillingEvent) =>
  new HandleBillingWebhook(world).execute(FakeBillingEvents.sign(event));

/** The colleague checks out (`paid` false while their trial runs) and then is charged. */
async function colleaguePays(world: World, schoolId: SchoolId, paid = true) {
  const subscription = await subscriptionOf(world, schoolId);
  const externalId = `sub_${schoolId}`;
  await deliver(world, {
    type: 'checkout_completed',
    clientReference: subscription.id,
    schoolId,
    externalId,
    planId: 'individual_monthly',
    quantity: 1,
    currentPeriodEnd: new Date(world.clock.now().getTime() + 30 * day),
    paid: false,
  });
  return deliver(world, {
    type: 'renewed',
    externalId,
    currentPeriodEnd: new Date(world.clock.now().getTime() + 30 * day),
    paid,
  });
}

describe('GetInvitePage', () => {
  it('makes the teacher a readable code once and keeps it', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    const first = valueOf(await invitePage(world, user));
    const again = valueOf(await invitePage(world, user));

    expect(first.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(again.code).toBe(first.code);
    expect(first).toMatchObject({
      joined: 0,
      freeMonths: 0,
      limitReached: false,
      maxFreeMonths: 3,
    });
  });

  it('tells the menu whether to show the invite page', async () => {
    const world = makeWorld();
    const { user, subscription } = await signedUp(world);
    const page = new GetInvitePage(world);

    expect(await page.isOpenTo(user)).toBe(true);
    await world.subscriptions.save({ ...subscription, planId: 'school', quantity: 10 });
    expect(await page.isOpenTo(user)).toBe(false);
  });

  it('is for individual accounts: a teacher on a school plan is refused', async () => {
    const world = makeWorld();
    const { user, subscription } = await signedUp(world);
    await world.subscriptions.save({ ...subscription, planId: 'school', quantity: 10 });

    expect(await invitePage(world, user)).toEqual({ ok: false, error: { code: 'forbidden' } });
  });

  it('counts only the teacher’s own colleagues, never another school’s', async () => {
    const world = makeWorld();
    const { user: ana } = await signedUp(world);
    const { user: carla } = await signedUp(world, 'carla@school.edu');
    await colleagueJoins(world, await codeOf(world, ana));

    expect(valueOf(await invitePage(world, ana)).joined).toBe(1);
    expect(valueOf(await invitePage(world, carla)).joined).toBe(0);
  });
});

describe('joining through an invite link', () => {
  it('records who invited a teacher who signs up with the email form', async () => {
    const world = makeWorld();
    const { user: ana } = await signedUp(world);
    const ben = await colleagueJoins(world, await codeOf(world, ana));

    expect(await world.referrals.findByInvitedSchool(ben.school.id)).toMatchObject({
      referrerId: ana.id,
      referrerSchoolId: ana.schoolId,
      status: 'joined',
    });
  });

  it('records who invited a teacher who signs up with Google', async () => {
    const world = makeWorld();
    const { user: ana } = await signedUp(world);
    const signedIn = valueOf(
      await new SignInWithGoogle(world).execute({
        code: 'good-code',
        redirectUri: 'https://app/cb',
        language: 'en',
        defaultSchoolName: 'My School',
        browser: { sessionToken: null, userAgent: null },
        referralCode: await codeOf(world, ana),
      }),
    );

    expect((await world.referrals.findByInvitedSchool(signedIn.school.id))?.referrerId).toBe(
      ana.id,
    );
  });

  it('still signs the teacher up when the code is unknown, badly typed or missing', async () => {
    const world = makeWorld();
    const unknown = await colleagueJoins(world, 'ZZZZZZZZ', 'a@school.edu');
    const typo = await colleagueJoins(world, 'not a code', 'b@school.edu');
    const none = await colleagueJoins(world, null, 'c@school.edu');

    for (const account of [unknown, typo, none]) {
      expect(await world.referrals.findByInvitedSchool(account.school.id)).toBeNull();
    }
  });
});

describe('the free month at the colleague’s first payment', () => {
  it('waits for real money: a checkout during the free trial earns nothing yet', async () => {
    const world = makeWorld();
    const { user: ana, subscription } = await signedUp(world);
    const ben = await colleagueJoins(world, await codeOf(world, ana));

    unwrap(await colleaguePays(world, ben.school.id, false));

    expect((await subscriptionOf(world, ana.schoolId)).trialEndsAt).toEqual(
      subscription.trialEndsAt,
    );
    expect((await world.referrals.findByInvitedSchool(ben.school.id))?.status).toBe('joined');
  });

  it('adds 30 days to the inviter’s trial when the colleague pays, once', async () => {
    const world = makeWorld();
    const { user: ana, subscription } = await signedUp(world);
    const ben = await colleagueJoins(world, await codeOf(world, ana));

    unwrap(await colleaguePays(world, ben.school.id));
    unwrap(await colleaguePays(world, ben.school.id));

    expect((await subscriptionOf(world, ana.schoolId)).trialEndsAt).toEqual(
      new Date(subscription.trialEndsAt.getTime() + 30 * day),
    );
    expect(valueOf(await invitePage(world, ana))).toMatchObject({ joined: 1, freeMonths: 1 });
  });

  it('moves a paying inviter’s next charge 30 days later through the payment provider', async () => {
    const world = makeWorld();
    const { user: ana, subscription } = await signedUp(world);
    const periodEnd = new Date(world.clock.now().getTime() + 20 * day);
    await world.subscriptions.save({
      ...subscription,
      status: 'active',
      externalId: 'sub_ana',
      currentPeriodEnd: periodEnd,
    });
    const ben = await colleagueJoins(world, await codeOf(world, ana));

    unwrap(await colleaguePays(world, ben.school.id));

    expect(world.billingRewards.delays).toEqual([
      { externalId: 'sub_ana', until: new Date(periodEnd.getTime() + 30 * day) },
    ]);
  });

  it('asks the payment provider to retry when it cannot give the month, and gives it then', async () => {
    const world = makeWorld();
    const { user: ana, subscription } = await signedUp(world);
    await world.subscriptions.save({ ...subscription, status: 'active', externalId: 'sub_ana' });
    const ben = await colleagueJoins(world, await codeOf(world, ana));
    world.billingRewards.fail = true;

    expect(await colleaguePays(world, ben.school.id)).toEqual({
      ok: false,
      error: { code: 'billing_failed' },
    });
    expect((await world.referrals.findByInvitedSchool(ben.school.id))?.status).toBe('joined');

    world.billingRewards.fail = false;
    unwrap(await colleaguePays(world, ben.school.id));
    expect(world.billingRewards.delays).toHaveLength(1);
  });

  it('stops at three free months a year', async () => {
    const world = makeWorld();
    const { user: ana } = await signedUp(world);
    const code = await codeOf(world, ana);
    for (const n of [1, 2, 3, 4]) {
      const colleague = await colleagueJoins(world, code, `colleague${String(n)}@school.edu`);
      unwrap(await colleaguePays(world, colleague.school.id));
    }

    expect(valueOf(await invitePage(world, ana))).toMatchObject({
      joined: 4,
      freeMonths: 3,
      limitReached: true,
    });
  });

  it('gives nothing to an inviter who has canceled', async () => {
    const world = makeWorld();
    const { user: ana, subscription } = await signedUp(world);
    const ben = await colleagueJoins(world, await codeOf(world, ana));
    await world.subscriptions.save(unwrap(cancelSubscription(subscription)));

    unwrap(await colleaguePays(world, ben.school.id));

    expect((await world.referrals.findByInvitedSchool(ben.school.id))?.status).toBe('not_rewarded');
  });
});
