import { isAdminOf, ok, type Result, type SchoolId, type User, type UserId } from '@thp/domain';
import type { UserRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

/** Super admin pages and actions; everyone else is refused. */
export const requireSuperAdmin = (actor: User): Result<true, UseCaseError> =>
  actor.role === 'super_admin' ? ok(true) : fail('forbidden');

/**
 * The school an admin acts on: their own, or any school for a super admin. Teachers, and school
 * admins naming another school, are refused.
 */
export function adminSchool(actor: User, schoolId?: SchoolId): Result<SchoolId, UseCaseError> {
  const school = schoolId ?? actor.schoolId;
  return isAdminOf(actor, school) ? ok(school) : fail('forbidden');
}

/** A user of a school the actor administers; anyone else is not found. */
export async function findManagedUser(
  users: UserRepository,
  actor: User,
  userId: UserId,
  schoolId?: SchoolId,
): Promise<Result<User, UseCaseError>> {
  const school = adminSchool(actor, schoolId);
  if (!school.ok) return school;
  const user = await users.findById(school.value, userId);
  return user === null ? fail('not_found') : ok(user);
}
