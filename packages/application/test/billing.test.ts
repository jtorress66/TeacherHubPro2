import { describe, expect, it } from 'vitest';
import { cancelSubscription, type UserId } from '@thp/domain';
import type { BillingEvent } from '@thp/ports';
import { FakeBillingEvents, FakeCheckoutSessions, aUser, unwrap } from '@thp/testing';
import { HandleBillingWebhook, StartCheckout } from '../src/index.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const checkout = (world: World, actor: Awaited<ReturnType<typeof signedUp>>['user'], planId = 'school' as const, quantity = 12) =>
  new StartCheckout(world).execute({ actor, planId, quantity, locale: 'es' });

describe('StartCheckout', () => {
  it('opens a checkout for the plan and seats chosen, returning to the billing page', async () => {
    const world = makeWorld();
    const { user, school, subscription } = await signedUp(world);

    const result = await checkout(world, user);

    expect(result).toEqual({ ok: true, value: { url: 'https://checkout.test/cs_test_1' } });
    expect(world.checkout.requests).toEqual([
      {
        planId: 'school',
        quantity: 12,
        customerEmail: user.email,
        clientReference: subscription.id,
        schoolId: school.id,
        trialEnd: subscription.trialEndsAt,
        successUrl: 'https://app.teacherhub.test/es/app/billing?checkout=success',
        cancelUrl: 'https://app.teacherhub.test/es/app/billing?checkout=canceled',
      },
    ]);
  });

  it('keeps the free days: the first charge is at the end of the trial', async () => {
    const world = makeWorld();
    const { user, subscription } = await signedUp(world);
    advanceDays(world, 3);

    await checkout(world, user, 'individual_monthly' as never, 1);
    expect(world.checkout.requests[0]?.trialEnd).toEqual(subscription.trialEndsAt);
  });

  it('charges at once when the trial is already over', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    advanceDays(world, 10);

    await checkout(world, user);
    expect(world.checkout.requests[0]?.trialEnd).toBeNull();
  });

  it('refuses fewer seats than the plan minimum', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    expect(await checkout(world, user, 'school', 5)).toEqual({ ok: false, error: { code: 'below_minimum_seats' } });
    expect(await checkout(world, user, 'district' as never, 99)).toEqual({
      ok: false,
      error: { code: 'below_minimum_seats' },
    });
    expect(world.checkout.requests).toHaveLength(0);
  });

  it('forbids a teacher who does not own the subscription', async () => {
    const world = makeWorld();
    const { school } = await signedUp(world);
    const colleague = aUser({ id: 'colleague' as UserId, schoolId: school.id, email: 'c@luz.edu' });

    expect(await checkout(world, colleague)).toEqual({ ok: false, error: { code: 'forbidden' } });
  });

  it('refuses a second purchase while already subscribed, and a canceled subscription', async () => {
    const world = makeWorld();
    const { user, school, subscription } = await signedUp(world);
    await world.subscriptions.save({ ...subscription, status: 'active' });
    expect(await checkout(world, user)).toEqual({ ok: false, error: { code: 'already_subscribed' } });

    await world.subscriptions.save(unwrap(cancelSubscription(subscription)));
    expect(await checkout(world, user)).toEqual({ ok: false, error: { code: 'subscription_ended' } });
    expect(school.id).toBe(subscription.schoolId);
  });

  it('reports a school without a subscription', async () => {
    const world = makeWorld();
    const stranger = aUser({ id: 'stranger' as UserId, email: 's@x.edu' });

    expect(await checkout(world, stranger)).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('turns a payment provider failure into billing_failed', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    world.checkout = new FakeCheckoutSessions({ fail: true });

    expect(await checkout(world, user)).toEqual({ ok: false, error: { code: 'billing_failed' } });
  });
});

describe('HandleBillingWebhook', () => {
  const periodEnd = new Date('2027-09-08T08:00:00.000Z');

  async function paidWorld() {
    const world = makeWorld();
    const account = await signedUp(world);
    const completed: BillingEvent = {
      type: 'checkout_completed',
      clientReference: account.subscription.id,
      schoolId: account.school.id,
      externalId: 'sub_stripe_1',
      planId: 'school',
      quantity: 12,
      currentPeriodEnd: periodEnd,
    };
    const handle = (event: BillingEvent) => new HandleBillingWebhook(world).execute(FakeBillingEvents.sign(event));
    return { world, account, completed, handle };
  }

  const stored = async ({ world, account }: Awaited<ReturnType<typeof paidWorld>>) =>
    world.subscriptions.findById(account.school.id, account.subscription.id);

  it('activates the subscription with the plan and seats bought at checkout', async () => {
    const paid = await paidWorld();

    expect(await paid.handle(paid.completed)).toEqual({ ok: true, value: { handled: true } });
    expect(await stored(paid)).toMatchObject({
      status: 'active',
      planId: 'school',
      quantity: 12,
      externalId: 'sub_stripe_1',
      currentPeriodEnd: periodEnd,
    });
  });

  it('is harmless when the provider sends the same event twice', async () => {
    const paid = await paidWorld();
    await paid.handle(paid.completed);

    expect(await paid.handle(paid.completed)).toEqual({ ok: true, value: { handled: true } });
    expect((await stored(paid))?.status).toBe('active');
  });

  it('renews, marks a failed payment as past due, and cancels', async () => {
    const paid = await paidWorld();
    await paid.handle(paid.completed);
    const nextYear = new Date('2028-09-08T08:00:00.000Z');

    await paid.handle({ type: 'payment_failed', externalId: 'sub_stripe_1' });
    expect((await stored(paid))?.status).toBe('past_due');
    await paid.handle({ type: 'payment_failed', externalId: 'sub_stripe_1' });
    expect((await stored(paid))?.status).toBe('past_due');

    await paid.handle({ type: 'renewed', externalId: 'sub_stripe_1', currentPeriodEnd: nextYear });
    expect(await stored(paid)).toMatchObject({ status: 'active', currentPeriodEnd: nextYear });

    await paid.handle({ type: 'canceled', externalId: 'sub_stripe_1' });
    await paid.handle({ type: 'canceled', externalId: 'sub_stripe_1' });
    expect((await stored(paid))?.status).toBe('canceled');
  });

  it('ignores an event that does not fit the subscription, instead of failing forever', async () => {
    const paid = await paidWorld();

    expect(await paid.handle({ type: 'payment_failed', externalId: 'sub_stripe_1' })).toEqual({
      ok: false,
      error: { code: 'unknown_subscription' },
    });
    await paid.handle(paid.completed);
    await paid.handle({ type: 'canceled', externalId: 'sub_stripe_1' });
    expect(await paid.handle({ type: 'renewed', externalId: 'sub_stripe_1', currentPeriodEnd: periodEnd })).toEqual({
      ok: true,
      value: { handled: false },
    });
  });

  it('rejects a bad signature and reports an unknown subscription so the provider retries', async () => {
    const paid = await paidWorld();

    expect(
      await new HandleBillingWebhook(paid.world).execute({ payload: JSON.stringify(paid.completed), signature: 'forged' }),
    ).toEqual({ ok: false, error: { code: 'invalid_signature' } });
    expect(await paid.handle({ ...paid.completed, clientReference: 'missing' as never })).toEqual({
      ok: false,
      error: { code: 'unknown_subscription' },
    });
  });

  it('ignores events it does not handle', async () => {
    const paid = await paidWorld();

    expect(
      await new HandleBillingWebhook(paid.world).execute({
        payload: JSON.stringify({ type: 'invoice.created' }),
        signature: FakeBillingEvents.signature,
      }),
    ).toEqual({ ok: true, value: { handled: false } });
  });

  it('rejects a completed checkout with seats below the plan minimum', async () => {
    const paid = await paidWorld();

    expect(await paid.handle({ ...paid.completed, quantity: 3 })).toEqual({
      ok: false,
      error: { code: 'below_minimum_seats' },
    });
  });
});
