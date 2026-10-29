import { isAdminOf, type Class, type User } from '@thp/domain';

/** The class's teacher, an admin of its school, or a super admin. */
export const canManageClass = (actor: User, cls: Class): boolean =>
  cls.teacherId === actor.id || isAdminOf(actor, cls.schoolId);
