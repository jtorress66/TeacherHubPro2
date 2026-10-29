import { isAdminOf, type SchoolId, type User } from '@thp/domain';
import type { SubscriptionRepository } from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';

/**
 * Who may change a school's own settings (details, semesters): an admin of that school, or the
 * teacher who owns its subscription (the teacher whose sign-up created it). Never another school.
 */
export class SchoolManagementPolicy {
  constructor(private readonly deps: { readonly subscriptions: SubscriptionRepository }) {}

  async allows(actor: User, schoolId: SchoolId): Promise<boolean> {
    if (actor.schoolId !== schoolId && actor.role !== 'super_admin') return false;
    if (isAdminOf(actor, schoolId)) return true;
    const subscription = await findSchoolSubscription(this.deps.subscriptions, schoolId);
    return subscription?.ownerId === actor.id;
  }
}
