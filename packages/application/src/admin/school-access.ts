import { canManageSchool, type User } from '@thp/domain';
import type { SubscriptionRepository } from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';

export interface SchoolAccessDeps {
  readonly subscriptions: SubscriptionRepository;
}

/** Whether the actor runs or owns their school (its admins, and the owner of its plan). */
export async function mayManageSchool(deps: SchoolAccessDeps, actor: User): Promise<boolean> {
  const subscription = await findSchoolSubscription(deps.subscriptions, actor.schoolId);
  return canManageSchool(actor, subscription);
}
