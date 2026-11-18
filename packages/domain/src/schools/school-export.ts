import type { SchoolId, UserId } from '../shared/ids.ts';
import { isAdminOf, type Role } from '../users/roles.ts';

interface Person {
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly role: Role;
}

/**
 * Who may download all of their school's data: its admins, and whoever owns the school's
 * subscription (a teacher with their own account). A canceled account still may: getting the
 * data back is what the download is for.
 */
export function canExportSchoolData(
  actor: Person,
  subscription: { readonly ownerId: UserId } | null,
): boolean {
  return isAdminOf(actor, actor.schoolId) || subscription?.ownerId === actor.id;
}
