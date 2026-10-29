import {
  archiveClass,
  createClass,
  isAdminOf,
  ok,
  restoreClass,
  updateClass,
  type Class,
  type ClassChanges,
  type ClassId,
  type Result,
  type SemesterId,
  type User,
} from '@thp/domain';
import type { ClassRepository, Clock, IdGenerator, SemesterRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findManagedClass } from './managed-class.ts';

async function semesterExists(
  semesters: SemesterRepository,
  actor: User,
  semesterId: SemesterId | null | undefined,
): Promise<boolean> {
  return semesterId == null || (await semesters.findById(actor.schoolId, semesterId)) !== null;
}

/** A teacher creates a class in their own school. */
export class CreateClass {
  constructor(
    private readonly deps: {
      readonly classes: ClassRepository;
      readonly semesters: SemesterRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    actor: User;
    details: ClassChanges;
  }): Promise<Result<Class, UseCaseError>> {
    const cls = createClass({
      ...input.details,
      id: this.deps.ids.next() as ClassId,
      schoolId: input.actor.schoolId,
      teacherId: input.actor.id,
    });
    if (!cls.ok) return cls;
    if (!(await semesterExists(this.deps.semesters, input.actor, cls.value.semesterId)))
      return fail('not_found');
    await this.deps.classes.save(cls.value);
    return ok(cls.value);
  }
}

export class UpdateClass {
  constructor(
    private readonly deps: {
      readonly classes: ClassRepository;
      readonly semesters: SemesterRepository;
    },
  ) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
    details: ClassChanges;
  }): Promise<Result<Class, UseCaseError>> {
    const found = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!found.ok) return found;
    const updated = updateClass(found.value, input.details);
    if (!updated.ok) return updated;
    if (!(await semesterExists(this.deps.semesters, input.actor, updated.value.semesterId)))
      return fail('not_found');
    await this.deps.classes.save(updated.value);
    return ok(updated.value);
  }
}

/** "Delete class": hidden from lists, kept with its roster and records, and restorable. */
export class ArchiveClass {
  constructor(
    private readonly deps: { readonly classes: ClassRepository; readonly clock: Clock },
  ) {}

  async execute(input: { actor: User; classId: ClassId }): Promise<Result<Class, UseCaseError>> {
    const found = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!found.ok) return found;
    const archived = archiveClass(found.value, this.deps.clock.now());
    await this.deps.classes.save(archived);
    return ok(archived);
  }
}

export class RestoreClass {
  constructor(private readonly deps: { readonly classes: ClassRepository }) {}

  async execute(input: { actor: User; classId: ClassId }): Promise<Result<Class, UseCaseError>> {
    const found = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!found.ok) return found;
    const restored = restoreClass(found.value);
    await this.deps.classes.save(restored);
    return ok(restored);
  }
}

export class GetClass {
  constructor(private readonly deps: { readonly classes: ClassRepository }) {}

  execute(input: { actor: User; classId: ClassId }): Promise<Result<Class, UseCaseError>> {
    return findManagedClass(this.deps.classes, input.actor, input.classId);
  }
}

/** A teacher's own classes; every class of the school for its admins. */
export class ListClasses {
  constructor(private readonly deps: { readonly classes: ClassRepository }) {}

  execute(input: { actor: User; includeArchived?: boolean }): Promise<readonly Class[]> {
    const { actor } = input;
    const options = { includeArchived: input.includeArchived === true };
    return isAdminOf(actor, actor.schoolId)
      ? this.deps.classes.listBySchool(actor.schoolId, options)
      : this.deps.classes.listByTeacher(actor.schoolId, actor.id, options);
  }
}
