import type { SchoolId } from '../shared/ids.ts';

export const roles = ['teacher', 'school_admin', 'super_admin'] as const;

export type Role = (typeof roles)[number];

interface HasRole {
  readonly role: Role;
  readonly schoolId: SchoolId;
}

/** Super admins administer every school; school admins only their own. */
export function isAdminOf(user: HasRole, schoolId: SchoolId): boolean {
  if (user.role === 'super_admin') return true;
  return user.role === 'school_admin' && user.schoolId === schoolId;
}
