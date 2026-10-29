import {
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
import { fail, type UseCaseError } from '../errors.ts';
import { SchoolManagementPolicy } from '../policies/school-management.ts';

export interface UpdateSchoolDetailsDeps {
  readonly schools: SchoolRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly users: UserRepository;
}

/** Edits a school's details, for those the school management policy allows. */
export class UpdateSchoolDetails {
  private readonly policy: SchoolManagementPolicy;

  constructor(private readonly deps: UpdateSchoolDetailsDeps) {
    this.policy = new SchoolManagementPolicy(deps);
  }

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    details: SchoolDetails;
  }): Promise<Result<School, UseCaseError>> {
    const { actor, schoolId } = input;
    if (actor.schoolId !== schoolId && actor.role !== 'super_admin') return fail('forbidden');
    const school = await this.deps.schools.findById(schoolId);
    if (!school) return fail('not_found');
    if (!(await this.policy.allows(actor, schoolId))) return fail('forbidden');

    const updated = updateSchoolDetails(school, input.details);
    if (!updated.ok) return updated;
    await this.deps.schools.save(updated.value);
    if (actor.schoolId === schoolId) await this.deps.users.save(markOnboardingStarted(actor));
    return ok(updated.value);
  }
}
