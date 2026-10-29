import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { UpdateProfile, UpdateSchoolDetails } from '../src/index.ts';
import { makeWorld, signedUp } from './world.ts';

describe('UpdateProfile', () => {
  it("changes the signed-in teacher's name and language", async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    const result = await new UpdateProfile(world).execute({
      actor: user,
      name: 'Ana María López',
      language: 'en',
    });

    expect(result.ok && result.value).toMatchObject({ name: 'Ana María López', language: 'en' });
    expect((await world.users.findById(user.schoolId, user.id))?.language).toBe('en');
  });

  it('rejects an invalid name', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    expect(await new UpdateProfile(world).execute({ actor: user, name: '', language: 'en' })).toEqual({
      ok: false,
      error: { field: 'name', code: 'required' },
    });
  });
});

describe('UpdateSchoolDetails', () => {
  const details = { name: 'Escuela Luz', address: 'Calle 1', phone: '555-0100', email: 'office@luz.edu' };

  it("lets the teacher who owns the school's subscription edit it, and starts their onboarding", async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);

    const result = await new UpdateSchoolDetails(world).execute({ actor: user, schoolId: school.id, details });

    expect(result.ok && result.value).toMatchObject({ id: school.id, name: 'Escuela Luz', email: 'office@luz.edu' });
    expect((await world.schools.findById(school.id))?.name).toBe('Escuela Luz');
    expect((await world.users.findById(school.id, user.id))?.onboardingStatus).toBe('in_progress');
  });

  it('lets a school admin edit their school', async () => {
    const world = makeWorld();
    const { school } = await signedUp(world);
    const admin = aUser({ id: 'admin-1' as UserId, schoolId: school.id, email: 'admin@luz.edu', role: 'school_admin' });
    await world.users.save(admin);

    const result = await new UpdateSchoolDetails(world).execute({ actor: admin, schoolId: school.id, details });
    expect(result.ok).toBe(true);
  });

  it('forbids another teacher of the same school', async () => {
    const world = makeWorld();
    const { school } = await signedUp(world);
    const colleague = aUser({ id: 'colleague' as UserId, schoolId: school.id, email: 'c@luz.edu' });

    expect(await new UpdateSchoolDetails(world).execute({ actor: colleague, schoolId: school.id, details })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it("never reaches another school's data, even for that school's admin role elsewhere", async () => {
    const world = makeWorld();
    const ana = await signedUp(world, 'ana@school.edu');
    const ben = await signedUp(world, 'ben@other.edu');
    const benAsAdmin = { ...ben.user, role: 'school_admin' as const };

    expect(
      await new UpdateSchoolDetails(world).execute({ actor: benAsAdmin, schoolId: ana.school.id, details }),
    ).toEqual({ ok: false, error: { code: 'forbidden' } });
    expect((await world.schools.findById(ana.school.id))?.name).toBe('Mi escuela');
  });

  it("lets a super admin edit any school without changing the super admin's own onboarding", async () => {
    const world = makeWorld();
    const ana = await signedUp(world, 'ana@school.edu');
    const ben = await signedUp(world, 'ben@other.edu');
    const superAdmin = { ...ben.user, role: 'super_admin' as const };

    const result = await new UpdateSchoolDetails(world).execute({
      actor: superAdmin,
      schoolId: ana.school.id,
      details,
    });

    expect(result.ok && result.value.name).toBe('Escuela Luz');
    expect((await world.users.findById(ben.school.id, ben.user.id))?.onboardingStatus).toBe('not_started');
  });

  it('reports an unknown school and invalid details', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);
    const superAdmin = { ...user, role: 'super_admin' as const };

    expect(
      await new UpdateSchoolDetails(world).execute({ actor: superAdmin, schoolId: 'nowhere' as SchoolId, details }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(
      await new UpdateSchoolDetails(world).execute({ actor: user, schoolId: school.id, details: { name: '' } }),
    ).toEqual({ ok: false, error: { field: 'name', code: 'required' } });
  });
});
