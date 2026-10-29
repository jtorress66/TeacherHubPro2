import { describe, expect, it } from 'vitest';
import {
  CreateClass,
  DismissOnboarding,
  GetOnboarding,
  UpdateSchoolDetails,
  defaultOnboardingItems,
  type OnboardingItem,
} from '../src/index.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const onboarding = (world: World, items: readonly OnboardingItem[] = defaultOnboardingItems) =>
  new GetOnboarding({ ...world, items, defaultSchoolNames: ['My School', 'Mi escuela'] });

describe('GetOnboarding', () => {
  it('starts with school information and a first class to do', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);

    expect(await onboarding(world).execute({ actor: user, school })).toEqual({
      show: true,
      done: 0,
      total: 2,
      items: [
        {
          id: 'school_info',
          labelKey: 'onboarding.schoolInfo',
          route: '/app/settings',
          done: false,
        },
        {
          id: 'first_class',
          labelKey: 'onboarding.firstClass',
          route: '/app/classes',
          done: false,
        },
      ],
    });
  });

  it('ticks school information once the school is no longer called "My School"', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);
    const renamed = await new UpdateSchoolDetails(world).execute({
      actor: user,
      schoolId: school.id,
      details: { name: 'Escuela Luz' },
    });
    if (!renamed.ok) return;

    const state = await onboarding(world).execute({ actor: user, school: renamed.value });
    expect(state).toMatchObject({ show: true, done: 1 });
  });

  it('completes and hides itself when everything is done', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);
    const renamed = await new UpdateSchoolDetails(world).execute({
      actor: user,
      schoolId: school.id,
      details: { name: 'Escuela Luz' },
    });
    await new CreateClass(world).execute({ actor: user, details: { name: 'Math' } });
    if (!renamed.ok) return;

    expect(await onboarding(world).execute({ actor: user, school: renamed.value })).toMatchObject({
      show: false,
      done: 2,
    });
    expect((await world.users.findById(user.schoolId, user.id))?.onboardingStatus).toBe(
      'completed',
    );
  });

  it('stays hidden once dismissed', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);

    const dismissed = await new DismissOnboarding(world).execute({ actor: user });
    expect(dismissed.onboardingStatus).toBe('dismissed');
    expect((await onboarding(world).execute({ actor: dismissed, school })).show).toBe(false);
  });

  it('is never shown to super admins', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);

    expect(
      (await onboarding(world).execute({ actor: { ...user, role: 'super_admin' }, school })).show,
    ).toBe(false);
  });

  it('counts any registered item, so later steps add items without changing the checklist', async () => {
    const world = makeWorld();
    const { user, school } = await signedUp(world);
    const firstPlan: OnboardingItem = {
      id: 'first_plan',
      labelKey: 'onboarding.firstPlan',
      route: '/app/plans',
      isDone: () => Promise.resolve(true),
    };

    const state = await onboarding(world, [...defaultOnboardingItems, firstPlan]).execute({
      actor: user,
      school,
    });
    expect(state).toMatchObject({ total: 3, done: 1 });
  });
});
