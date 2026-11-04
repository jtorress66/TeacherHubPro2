import type { ClassId, Email, PortalLink, PortalLinkId, SchoolId, StudentId } from '@thp/domain';
import type { PortalLinksTable } from '../schema.ts';
import type { RowMapper } from './columns.ts';

export const portalLinkMapper: RowMapper<PortalLink, PortalLinksTable> = {
  toRow: (link) => ({
    id: link.id,
    school_id: link.schoolId,
    class_id: link.classId,
    student_id: link.studentId,
    token_hash: link.tokenHash,
    sent_to: link.sentTo,
    expires_at: link.expiresAt,
    revoked_at: link.revokedAt,
  }),
  fromRow: (row) => ({
    id: row.id as PortalLinkId,
    schoolId: row.school_id as SchoolId,
    classId: row.class_id as ClassId,
    studentId: row.student_id as StudentId,
    tokenHash: row.token_hash,
    sentTo: row.sent_to as Email | null,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }),
};
