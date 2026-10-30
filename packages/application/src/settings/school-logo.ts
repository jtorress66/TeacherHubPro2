import {
  logoKeyFor,
  ok,
  setSchoolLogo,
  validateLogo,
  type Result,
  type School,
  type User,
} from '@thp/domain';
import type { FileStore, SchoolRepository, StoredFile, SubscriptionRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { SchoolManagementPolicy } from '../policies/school-management.ts';

export interface SchoolLogoDeps {
  readonly schools: SchoolRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly files: FileStore;
}

/** The actor's school, when the school management policy lets them change it. */
async function managedSchool(
  deps: SchoolLogoDeps,
  actor: User,
): Promise<Result<School, UseCaseError>> {
  if (!(await new SchoolManagementPolicy(deps).allows(actor, actor.schoolId))) {
    return fail('forbidden');
  }
  const school = await deps.schools.findById(actor.schoolId);
  return school ? ok(school) : fail('not_found');
}

/** Stores a PNG or JPEG logo (at most 1 MB) for the actor's school, replacing any earlier one. */
export class UploadSchoolLogo {
  constructor(private readonly deps: SchoolLogoDeps) {}

  async execute(input: { actor: User; bytes: Uint8Array }): Promise<Result<School, UseCaseError>> {
    const school = await managedSchool(this.deps, input.actor);
    if (!school.ok) return school;
    const contentType = validateLogo(input.bytes);
    if (!contentType.ok) return contentType;
    const key = logoKeyFor(school.value.id);
    const stored = await this.deps.files.put(key, {
      bytes: input.bytes,
      contentType: contentType.value,
    });
    if (!stored.ok) return fail('storage_unavailable');
    const updated = setSchoolLogo(school.value, key);
    await this.deps.schools.save(updated);
    return ok(updated);
  }
}

export class RemoveSchoolLogo {
  constructor(private readonly deps: SchoolLogoDeps) {}

  async execute(input: { actor: User }): Promise<Result<School, UseCaseError>> {
    const school = await managedSchool(this.deps, input.actor);
    if (!school.ok) return school;
    await this.deps.files.delete(logoKeyFor(school.value.id));
    const updated = setSchoolLogo(school.value, null);
    await this.deps.schools.save(updated);
    return ok(updated);
  }
}

/** The logo of the actor's own school, for anyone in that school; null when there is none. */
export class GetSchoolLogo {
  constructor(private readonly deps: Pick<SchoolLogoDeps, 'schools' | 'files'>) {}

  async execute(input: { actor: User }): Promise<Result<StoredFile | null, UseCaseError>> {
    const school = await this.deps.schools.findById(input.actor.schoolId);
    if (school?.logoKey == null) return ok(null);
    const file = await this.deps.files.get(school.logoKey);
    return ok(file.ok ? file.value : null);
  }
}
