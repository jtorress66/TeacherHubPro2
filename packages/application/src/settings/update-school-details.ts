import {
  isAdminOf,
  markOnboardingStarted,
  ok,
  updateSchoolDetails,
  type Result,
  type School,
  type SchoolDetails,
  type SchoolId,
  type User,
} from '@thp/domain';
import type { SchoolRepository, SubscriptionRepository, UserRepository } from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';

export interface UpdateSchoolDetailsDeps {
  readonly schools: SchoolRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly users: UserRepository;
}

/**
 * Edits a school's details. Allowed for an admin of that school, or for the teacher who owns the
 * school's subscription (the teacher whose sign-up created it). Never for another school.
 */
export class UpdateSchoolDetails {
  constructor(private readonly deps: UpdateSchoolDetailsDeps) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    details: SchoolDetails;
  }): Promise<Result<School, UseCaseError>> {
    const { actor, schoolId } = input;
    if (actor.schoolId !== schoolId && actor.role !== 'super_admin') return fail('forbidden');
    const school = await this.deps.schools.findById(schoolId);
    if (!school) return fail('not_found');
    if (!isAdminOf(actor, schoolId) && !(await this.ownsSubscription(actor))) {
      return fail('forbidden');
    }

    const updated = updateSchoolDetails(school, input.details);
    if (!updated.ok) return updated;
    await this.deps.schools.save(updated.value);
    if (actor.schoolId === schoolId) await this.deps.users.save(markOnboardingStarted(actor));
    return ok(updated.value);
  }

  private async ownsSubscription(actor: User): Promise<boolean> {
    const subscription = await findSchoolSubscription(this.deps.subscriptions, actor.schoolId);
    return subscription?.ownerId === actor.id;
  }
}
