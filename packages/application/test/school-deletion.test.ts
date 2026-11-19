import { describe, expect, it } from 'vitest';
import type { SchoolId, Subscription } from '@thp/domain';
import {
  CancelSchoolDeletion,
  DeleteDueSchools,
  GetSchoolDeletion,
  RequestSchoolDeletion,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const day = 24 * 60 * 60 * 1000;

/** A teacher with their own account; their school is called "Mi escuela". */
async function owner(world: World, email?: string) {
  return (await signedUp(world, email)).user;
}

/** The school's subscription, paid through the provider as `sub_paid`. */
async function paid(world: World, schoolId: SchoolId, status: Subscription['status'] = 'active') {
  const [subscription] = await world.subscriptions.listBySchool(schoolId);
  if (subscription === undefined) throw new Error('no subscription');
  await world.subscriptions.save({ ...subscription, status, externalId: 'sub_paid' });
}

describe('RequestSchoolDeletion', () => {
  it('holds the request for 30 days once the school’s name is typed', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    const request = valueOf(
      await new RequestSchoolDeletion(world).execute({ actor, typedName: ' mi ESCUELA ' }),
    );

    expect(request).toEqual({
      schoolId: actor.schoolId,
      requestedBy: actor.id,
      requestedAt: world.clock.now(),
      deleteAfter: new Date(world.clock.now().getTime() + 30 * day),
    });
    expect(await world.schoolDeletions.findBySchool(actor.schoolId)).toEqual(request);
  });

  it('refuses a name that is not the school’s', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    expect(
      await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Otra escuela' }),
    ).toEqual({ ok: false, error: { code: 'name_mismatch' } });
    expect(await world.schoolDeletions.findBySchool(actor.schoolId)).toBeNull();
  });

  it('is open to the school’s admins and refused to its other teachers', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const admin = colleagueOf(actor, 'school_admin');
    const teacher = colleagueOf(actor, 'teacher');
    await world.users.save(admin);
    await world.users.save(teacher);
    const requests = new RequestSchoolDeletion(world);

    expect(await requests.isOpenTo(actor)).toBe(true);
    expect(await requests.isOpenTo(admin)).toBe(true);
    expect(await requests.isOpenTo(teacher)).toBe(false);
    expect(await requests.execute({ actor: teacher, typedName: 'Mi escuela' })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('is refused for a school with a super admin', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await world.users.save(colleagueOf(actor, 'super_admin'));

    expect(
      await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }),
    ).toEqual({ ok: false, error: { code: 'forbidden' } });
  });

  it('stops a paid plan renewing, so nothing more is charged', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await paid(world, actor.schoolId);

    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));

    expect(world.subscriptionRenewal.stopped).toEqual(['sub_paid']);
  });

  it('keeps no request when the payment service cannot be reached', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await paid(world, actor.schoolId);
    world.subscriptionRenewal.fail = true;

    expect(
      await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }),
    ).toEqual({ ok: false, error: { code: 'renewal_failed' } });
    expect(await world.schoolDeletions.findBySchool(actor.schoolId)).toBeNull();
  });

  it('leaves a plan that has already ended alone', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await paid(world, actor.schoolId, 'canceled');

    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));

    expect(world.subscriptionRenewal.stopped).toEqual([]);
  });

  it('keeps the first date when asked again', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const requests = new RequestSchoolDeletion(world);
    const first = valueOf(await requests.execute({ actor, typedName: 'Mi escuela' }));
    world.clock.advanceBy(day);

    expect(valueOf(await requests.execute({ actor, typedName: 'Mi escuela' }))).toEqual(first);
  });

  it('emails the person who asked, with the date and a way to cancel', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));

    expect(world.mailer.outbox).toEqual([
      expect.objectContaining({
        to: actor.email,
        subject: '[es] Mi escuela deletion on 2026-10-01',
        text: expect.stringContaining('https://app.teacherhub.test/es/app/settings') as string,
      }),
    ]);
  });

  it('records the request in the activity log, by ID only', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));

    expect(world.auditLog.events).toEqual([
      expect.objectContaining({
        schoolId: actor.schoolId,
        actorId: actor.id,
        action: 'school_deletion_requested',
        targetId: null,
      }),
    ]);
  });
});

describe('CancelSchoolDeletion', () => {
  it('drops the request and turns renewal back on', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await paid(world, actor.schoolId);
    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));

    valueOf(await new CancelSchoolDeletion(world).execute({ actor }));

    expect(await world.schoolDeletions.findBySchool(actor.schoolId)).toBeNull();
    expect(world.subscriptionRenewal.resumed).toEqual(['sub_paid']);
    expect(world.auditLog.events.map((e) => e.action)).toEqual([
      'school_deletion_requested',
      'school_deletion_canceled',
    ]);
  });

  it('keeps the request when renewal cannot be turned back on', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await paid(world, actor.schoolId);
    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));
    world.subscriptionRenewal.fail = true;

    expect(await new CancelSchoolDeletion(world).execute({ actor })).toEqual({
      ok: false,
      error: { code: 'renewal_failed' },
    });
    expect(await world.schoolDeletions.findBySchool(actor.schoolId)).not.toBeNull();
  });

  it('cancels without the payment service once the plan has ended', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));
    await paid(world, actor.schoolId, 'canceled');

    valueOf(await new CancelSchoolDeletion(world).execute({ actor }));

    expect(world.subscriptionRenewal.resumed).toEqual([]);
  });

  it('is refused to other teachers, and says when there is nothing to cancel', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const teacher = colleagueOf(actor, 'teacher');
    await world.users.save(teacher);
    const cancel = new CancelSchoolDeletion(world);

    expect(await cancel.execute({ actor })).toEqual({ ok: false, error: { code: 'not_found' } });
    valueOf(await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }));
    expect(await cancel.execute({ actor: teacher })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});

describe('GetSchoolDeletion', () => {
  it('shows everyone in the school the pending request, and no one elsewhere', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const teacher = colleagueOf(actor, 'teacher');
    const other = await owner(world, 'bo@other.edu');
    const request = valueOf(
      await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }),
    );
    const pending = new GetSchoolDeletion(world);

    expect(await pending.execute({ actor: teacher })).toEqual(request);
    expect(await pending.execute({ actor: other })).toBeNull();
  });
});

describe('DeleteDueSchools', () => {
  it('deletes a school only once its 30 days are over', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const other = await owner(world, 'bo@other.edu');
    const request = valueOf(
      await new RequestSchoolDeletion(world).execute({ actor, typedName: 'Mi escuela' }),
    );
    const sweep = new DeleteDueSchools(world);

    world.clock.advanceBy(30 * day - 1);
    expect(await sweep.execute()).toBe(0);
    expect(world.schoolEraser.erased).toEqual([]);

    world.clock.advanceBy(1);
    expect(await sweep.execute()).toBe(1);
    expect(world.schoolEraser.erased).toEqual([
      {
        schoolId: actor.schoolId,
        requestedBy: actor.id,
        requestedAt: request.requestedAt,
        deletedAt: world.clock.now(),
      },
    ]);
    expect(world.schoolEraser.erased.map((e) => e.schoolId)).not.toContain(other.schoolId);
    expect(await sweep.execute()).toBe(0);
  });
});
