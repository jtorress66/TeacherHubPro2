import type { Role } from '../users/roles.ts';
import { hasAccess, trialDaysLeft, type Subscription } from './subscription.ts';

export interface Access {
  readonly hasAccess: boolean;
  /** Days left in the free trial; null when not on a trial. */
  readonly trialDaysLeft: number | null;
  /** The platform's owners (super admins) always have full access, with no plan. */
  readonly owner: boolean;
}

/**
 * Whether someone may use the app: super admins always may; everyone else through their
 * school's trial or plan, and not at all without one.
 */
export function accessFor(
  user: { readonly role: Role },
  subscription: Subscription | null,
  now: Date,
): Access {
  if (user.role === 'super_admin') return { hasAccess: true, trialDaysLeft: null, owner: true };
  if (subscription === null) return { hasAccess: false, trialDaysLeft: null, owner: false };
  return {
    hasAccess: hasAccess(subscription, now),
    trialDaysLeft: trialDaysLeft(subscription, now),
    owner: false,
  };
}
