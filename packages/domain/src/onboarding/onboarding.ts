import type { User } from '../users/user.ts';

/** Super admins manage the platform and skip the teacher onboarding. */
export const onboardingApplies = (user: User): boolean => user.role !== 'super_admin';

export const dismissOnboarding = (user: User): User => ({ ...user, onboardingStatus: 'dismissed' });

/** Everything is set up; a teacher who dismissed the checklist keeps it dismissed. */
export const completeOnboarding = (user: User): User =>
  user.onboardingStatus === 'dismissed' ? user : { ...user, onboardingStatus: 'completed' };
