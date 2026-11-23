import { describe, expect, it } from 'vitest';
import { activateSubscription, type SchoolId, type User } from '@thp/domain';
import { ExtendSchoolTrial, GetSchoolTrial, checkPaidAccess } from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const day = 24 * 60 * 60 * 1000;
const forbidden = { ok: false, error: { code: 'forbidden' } };

async function rootOf(world: World): Promise<User> {
  const { user } = await signedUp(world, 'root@platform.edu');
  return { ...user, role: 'super_admin' };
}

/** A teacher whose 7-day trial ended long ago, and a super admin from another school. */
async function endedTrial() {
  const world = makeWorld();
  const { user: teacher } = await signedUp(world, 'reviewer@canva.com');
  const root = await rootOf(world);
  advanceDays(world, 30);
  return { world, teacher, root };
}

const extend = (world: World, actor: User, schoolId: SchoolId, days: number) =>
  new ExtendSchoolTrial(world).execute({ actor, schoolId, days });

describe('ExtendSchoolTrial', () => {
  it('gives a school whose trial ended its paid features back for the days asked', async () => {
    const { world, teacher, root } = await endedTrial();
    expect(await checkPaidAccess(world, teacher)).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });

    const trial = valueOf(await extend(world, root, teacher.schoolId, 30));

    expect(trial).toEqual({
      status: 'trialing',
      trialEndsAt: new Date(world.clock.now().getTime() + 30 * day),
    });
    expect(await checkPaidAccess(world, teacher)).toEqual({ ok: true, value: true });
    advanceDays(world, 31);
    expect((await checkPaidAccess(world, teacher)).ok).toBe(false);
  });

  it("writes it in the school's activity log, with the days given", async () => {
    const { world, teacher, root } = await endedTrial();

    valueOf(await extend(world, root, teacher.schoolId, 14));

    const events = await world.auditLog.listForSchool(teacher.schoolId, 10);
    expect(events[0]).toMatchObject({
      schoolId: teacher.schoolId,
      actorId: root.id,
      action: 'school_trial_extended',
      count: 14,
    });
  });

  it('is only for super admins', async () => {
    const { world, teacher } = await endedTrial();
    const admin: User = { ...teacher, role: 'school_admin' };

    expect(await extend(world, teacher, teacher.schoolId, 30)).toEqual(forbidden);
    expect(await extend(world, admin, teacher.schoolId, 30)).toEqual(forbidden);
    expect((await checkPaidAccess(world, teacher)).ok).toBe(false);
  });

  it('gives 1 to 90 whole days', async () => {
    const { world, teacher, root } = await endedTrial();

    for (const days of [0, 91, 1.5]) {
      expect(await extend(world, root, teacher.schoolId, days)).toMatchObject({
        ok: false,
        error: { field: 'days', code: 'out_of_range' },
      });
    }
    expect(await world.auditLog.listForSchool(teacher.schoolId, 10)).toEqual([]);
  });

  it('leaves a paying school alone', async () => {
    const { world, teacher, root } = await endedTrial();
    const subscription = (await world.subscriptions.listBySchool(teacher.schoolId)).at(-1);
    if (subscription === undefined) throw new Error('the teacher has no trial');
    const paid = valueOf(
      activateSubscription(subscription, {
        currentPeriodEnd: new Date(world.clock.now().getTime() + 30 * day),
      }),
    );
    await world.subscriptions.save(paid);

    expect(await extend(world, root, teacher.schoolId, 30)).toEqual({
      ok: false,
      error: { code: 'school_is_paying' },
    });
    expect((await world.subscriptions.listBySchool(teacher.schoolId)).at(-1)).toEqual(paid);
  });

  it('finds nothing for a school without a subscription', async () => {
    const world = makeWorld();
    const root = await rootOf(world);

    expect(await extend(world, root, 'no-such-school' as SchoolId, 30)).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('GetSchoolTrial', () => {
  it("shows a super admin the school's subscription status and trial end", async () => {
    const { world, teacher, root } = await endedTrial();

    const trial = valueOf(
      await new GetSchoolTrial(world).execute({ actor: root, schoolId: teacher.schoolId }),
    );

    expect(trial).toEqual({
      status: 'trialing',
      trialEndsAt: new Date(world.clock.now().getTime() - 23 * day),
    });
  });

  it('is only for super admins, and is empty for a school without a subscription', async () => {
    const { world, teacher, root } = await endedTrial();

    expect(
      await new GetSchoolTrial(world).execute({ actor: teacher, schoolId: teacher.schoolId }),
    ).toEqual(forbidden);
    expect(
      await new GetSchoolTrial(world).execute({ actor: root, schoolId: 'none' as SchoolId }),
    ).toEqual({ ok: true, value: null });
  });
});
