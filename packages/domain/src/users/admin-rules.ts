import type { SchoolId, UserId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { isAdminOf, roles, type Role } from './roles.ts';

interface Person {
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly role: Role;
}

/** Why an admin action is refused. */
export interface AdminRefusal {
  readonly code: 'forbidden' | 'own_account' | 'has_classes';
}

const refuse = (code: AdminRefusal['code']) => err<AdminRefusal>({ code });

/** The roles an actor may give: school admins up to school admin, super admins any role. */
export function assignableRoles(actor: Pick<Person, 'role'>): readonly Role[] {
  if (actor.role === 'super_admin') return roles;
  if (actor.role === 'school_admin') return ['teacher', 'school_admin'];
  return [];
}

/**
 * An admin of the target's school may give a role they are allowed to give, but never change
 * their own role, and a school admin never touches a super admin.
 */
export function checkRoleChange(
  actor: Person,
  target: Person,
  role: Role,
): Result<true, AdminRefusal> {
  if (actor.id === target.id) return refuse('own_account');
  if (!isAdminOf(actor, target.schoolId)) return refuse('forbidden');
  if (!assignableRoles(actor).includes(role) || !assignableRoles(actor).includes(target.role)) {
    return refuse('forbidden');
  }
  return ok(true);
}

/** Nobody removes themselves; a teacher's classes are handed over first. */
export function checkRemoval(
  actor: Person,
  target: Person,
  ownedClasses: number,
): Result<true, AdminRefusal> {
  if (actor.id === target.id) return refuse('own_account');
  return checkMove(ownedClasses);
}

/** Classes belong to their school, so a teacher changes schools only without classes. */
export const checkMove = (ownedClasses: number): Result<true, AdminRefusal> =>
  ownedClasses > 0 ? refuse('has_classes') : ok(true);

/** A school is deleted only when no one belongs to it. */
export const canDeleteSchool = (userCount: number): boolean => userCount === 0;
