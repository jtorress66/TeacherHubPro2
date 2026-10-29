import { ok, type Class, type ClassId, type Result, type User } from '@thp/domain';
import type { ClassRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { canManageClass } from '../policies/class-access.ts';

/** A class in the actor's school that they may manage; another school's class is not found. */
export async function findManagedClass(
  classes: ClassRepository,
  actor: User,
  classId: ClassId,
): Promise<Result<Class, UseCaseError>> {
  const cls = await classes.findById(actor.schoolId, classId);
  if (!cls) return fail('not_found');
  return canManageClass(actor, cls) ? ok(cls) : fail('forbidden');
}
