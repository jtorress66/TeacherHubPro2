import type { ExpiringLink } from '../assignments/student-link.ts';
import type { Email } from '../shared/email.ts';
import type { ClassId, PortalLinkId, SchoolId, StudentId } from '../shared/ids.ts';

/**
 * A family's read-only link to one student's progress. Parents have no accounts: the link is the
 * key, so only its hash is stored; it can be revoked and it expires (like a student's link).
 */
export interface PortalLink extends ExpiringLink {
  readonly id: PortalLinkId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly studentId: StudentId;
  readonly tokenHash: string;
  /** The address it was last emailed to, if it was emailed. */
  readonly sentTo: Email | null;
}

export const createPortalLink = (input: Omit<PortalLink, 'revokedAt'>): PortalLink => ({
  ...input,
  revokedAt: null,
});
