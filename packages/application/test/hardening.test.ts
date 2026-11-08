import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import { aUser, InMemoryAuditLog, InMemoryRateLimiter } from '@thp/testing';
import { ListActivity, RecordActivity, Throttle } from '../src/index.ts';
import { makeWorld } from './world.ts';

const withHardening = () => ({
  ...makeWorld(),
  rateLimiter: new InMemoryRateLimiter(),
  auditLog: new InMemoryAuditLog(),
});

describe('Throttle', () => {
  it('refuses the 6th login for one email within 15 minutes', async () => {
    const world = withHardening();
    const throttle = new Throttle(world);
    const tries = [];
    for (let i = 0; i < 6; i += 1) {
      tries.push((await throttle.execute({ rule: 'logInEmail', subject: 'ana@school.edu' })).ok);
    }

    expect(tries).toEqual([true, true, true, true, true, false]);
    expect(await throttle.execute({ rule: 'logInEmail', subject: 'ben@school.edu' })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('answers rate_limited and allows again after the window', async () => {
    const world = withHardening();
    const throttle = new Throttle(world);
    for (let i = 0; i < 5; i += 1)
      await throttle.execute({ rule: 'passwordReset', subject: '1.2.3.4' });

    expect(await throttle.execute({ rule: 'passwordReset', subject: '1.2.3.4' })).toEqual({
      ok: false,
      error: { code: 'rate_limited' },
    });
    world.clock.advanceBy(60 * 60_000);
    expect((await throttle.execute({ rule: 'passwordReset', subject: '1.2.3.4' })).ok).toBe(true);
  });

  it('stores only hashed keys, never the email or address', async () => {
    const world = withHardening();
    const keys: string[] = [];
    const spy = { hit: (input: { key: string }) => (keys.push(input.key), Promise.resolve(true)) };
    await new Throttle({ ...world, rateLimiter: spy }).execute({
      rule: 'logInEmail',
      subject: 'ana@school.edu',
    });

    expect(keys[0]).not.toContain('ana');
  });
});

describe('RecordActivity and ListActivity', () => {
  const schoolA = 'school-a' as SchoolId;
  const admin = aUser({ id: 'admin-1' as UserId, schoolId: schoolA, role: 'school_admin' });
  const teacher = aUser({ id: 'teacher-1' as UserId, schoolId: schoolA });

  it("records an action in the actor's school, with the time from the clock", async () => {
    const world = withHardening();
    await new RecordActivity(world).execute({
      actor: teacher,
      action: 'grades_saved',
      targetId: 'assignment-1',
    });

    expect(world.auditLog.events).toMatchObject([
      {
        schoolId: schoolA,
        actorId: teacher.id,
        action: 'grades_saved',
        targetId: 'assignment-1',
        at: world.clock.now(),
      },
    ]);
  });

  it('records a super admin’s change in the school they changed', async () => {
    const world = withHardening();
    const owner = aUser({ id: 'owner-1' as UserId, schoolId: schoolA, role: 'super_admin' });
    const schoolB = 'school-b' as SchoolId;
    await new RecordActivity(world).execute({
      actor: owner,
      action: 'school_updated',
      schoolId: schoolB,
    });

    expect(world.auditLog.events[0]?.schoolId).toBe(schoolB);
  });

  it("lets a school admin read their own school's activity", async () => {
    const world = withHardening();
    await new RecordActivity(world).execute({ actor: teacher, action: 'student_added' });

    const listed = await new ListActivity(world).execute({ actor: admin, schoolId: schoolA });

    expect(listed.ok && listed.value.map((event) => event.action)).toEqual(['student_added']);
  });

  it("refuses teachers and another school's admin", async () => {
    const world = withHardening();
    const otherAdmin = aUser({
      id: 'admin-2' as UserId,
      schoolId: 'school-b' as SchoolId,
      role: 'school_admin',
    });

    expect(await new ListActivity(world).execute({ actor: teacher, schoolId: schoolA })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await new ListActivity(world).execute({ actor: otherAdmin, schoolId: schoolA })).toEqual(
      { ok: false, error: { code: 'forbidden' } },
    );
  });
});
