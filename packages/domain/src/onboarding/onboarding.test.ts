import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import { valueOf } from '../test-support.ts';
import { createUser, type UserInput } from '../users/user.ts';
import { completeOnboarding, dismissOnboarding, onboardingApplies } from './onboarding.ts';

const user = (overrides: Partial<UserInput> = {}) =>
  valueOf(
    createUser({
      id: 'u1' as UserId,
      schoolId: 's1' as SchoolId,
      email: 'ana@school.edu',
      name: 'Ana',
      ...overrides,
    }),
  );

describe('onboarding', () => {
  it('can be dismissed', () => {
    expect(dismissOnboarding(user()).onboardingStatus).toBe('dismissed');
  });

  it('is completed once everything is set up, unless the teacher dismissed it', () => {
    expect(completeOnboarding(user({ onboardingStatus: 'in_progress' })).onboardingStatus).toBe(
      'completed',
    );
    expect(completeOnboarding(user({ onboardingStatus: 'dismissed' })).onboardingStatus).toBe(
      'dismissed',
    );
  });

  it('does not apply to super admins, who manage the platform', () => {
    expect(onboardingApplies(user())).toBe(true);
    expect(onboardingApplies(user({ role: 'super_admin' }))).toBe(false);
  });
});
