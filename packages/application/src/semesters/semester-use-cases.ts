import {
  activateSemester,
  compareDates,
  createSemester,
  ok,
  updateSemester,
  type Result,
  type Semester,
  type SemesterChanges,
  type SemesterId,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  IdGenerator,
  SemesterRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { SchoolManagementPolicy } from '../policies/school-management.ts';

interface SemesterDeps {
  readonly semesters: SemesterRepository;
  readonly subscriptions: SubscriptionRepository;
}

/** A semester of the actor's own school that they may manage; another school's is not found. */
async function findManagedSemester(
  deps: SemesterDeps,
  actor: User,
  semesterId: SemesterId,
): Promise<Result<Semester, UseCaseError>> {
  const semester = await deps.semesters.findById(actor.schoolId, semesterId);
  if (!semester) return fail('not_found');
  const allowed = await new SchoolManagementPolicy(deps).allows(actor, actor.schoolId);
  return allowed ? ok(semester) : fail('forbidden');
}

/** Makes one semester the active one; the rest of the school's semesters become inactive. */
async function makeActive(semesters: SemesterRepository, semester: Semester): Promise<void> {
  const all = await semesters.listBySchool(semester.schoolId);
  const activated = activateSemester(all, semester.id);
  if (!activated.ok) return;
  // Turn the others off first: a school may never have two active semesters, even for a moment.
  const ordered = [...activated.value].sort((a, b) => Number(a.isActive) - Number(b.isActive));
  for (const updated of ordered) await semesters.save(updated);
}

export class CreateSemester {
  constructor(private readonly deps: SemesterDeps & { readonly ids: IdGenerator }) {}

  async execute(input: {
    actor: User;
    details: SemesterChanges;
    makeActive?: boolean;
  }): Promise<Result<Semester, UseCaseError>> {
    const { actor } = input;
    if (!(await new SchoolManagementPolicy(this.deps).allows(actor, actor.schoolId)))
      return fail('forbidden');
    const semester = createSemester({
      ...input.details,
      id: this.deps.ids.next() as SemesterId,
      schoolId: actor.schoolId,
    });
    if (!semester.ok) return semester;
    await this.deps.semesters.save(semester.value);
    if (input.makeActive === true) await makeActive(this.deps.semesters, semester.value);
    return ok({ ...semester.value, isActive: input.makeActive === true });
  }
}

export class UpdateSemester {
  constructor(private readonly deps: SemesterDeps) {}

  async execute(input: {
    actor: User;
    semesterId: SemesterId;
    details: SemesterChanges;
  }): Promise<Result<Semester, UseCaseError>> {
    const found = await findManagedSemester(this.deps, input.actor, input.semesterId);
    if (!found.ok) return found;
    const updated = updateSemester(found.value, input.details);
    if (!updated.ok) return updated;
    await this.deps.semesters.save(updated.value);
    return ok(updated.value);
  }
}

export class SetActiveSemester {
  constructor(private readonly deps: SemesterDeps) {}

  async execute(input: {
    actor: User;
    semesterId: SemesterId;
  }): Promise<Result<true, UseCaseError>> {
    const found = await findManagedSemester(this.deps, input.actor, input.semesterId);
    if (!found.ok) return found;
    await makeActive(this.deps.semesters, found.value);
    return ok(true);
  }
}

/** A semester can be deleted only while no class uses it (as in the original app). */
export class DeleteSemester {
  constructor(private readonly deps: SemesterDeps & { readonly classes: ClassRepository }) {}

  async execute(input: {
    actor: User;
    semesterId: SemesterId;
  }): Promise<Result<true, UseCaseError>> {
    const found = await findManagedSemester(this.deps, input.actor, input.semesterId);
    if (!found.ok) return found;
    if ((await this.deps.classes.countBySemester(found.value.schoolId, found.value.id)) > 0) {
      return fail('semester_in_use');
    }
    await this.deps.semesters.delete(found.value.schoolId, found.value.id);
    return ok(true);
  }
}

/** The school's semesters, latest first. Every teacher of the school may see them. */
export class ListSemesters {
  constructor(private readonly deps: { readonly semesters: SemesterRepository }) {}

  async execute(input: { actor: User }): Promise<Semester[]> {
    const all = await this.deps.semesters.listBySchool(input.actor.schoolId);
    return [...all].sort((a, b) => compareDates(b.startDate, a.startDate));
  }
}
