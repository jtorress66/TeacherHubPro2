import { ok, type Class, type ClassId, type Result, type User } from '@thp/domain';
import type { ClassRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';

export interface ClassInput {
  readonly actor: User;
  readonly classId: ClassId;
}

/** A class the actor manages that is still in use; archived classes keep their grades read-only. */
export async function findEditableClass(
  classes: ClassRepository,
  actor: User,
  classId: ClassId,
): Promise<Result<Class, UseCaseError>> {
  const cls = await findManagedClass(classes, actor, classId);
  if (!cls.ok) return cls;
  return cls.value.archivedAt === null ? ok(cls.value) : fail('class_archived');
}
