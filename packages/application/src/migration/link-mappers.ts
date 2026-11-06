import {
  createPortalLink,
  createStudentLink,
  parseEmail,
  type PortalLinkId,
  type StudentLinkId,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { instant, text } from './legacy-fields.ts';
import type { LegacyMapper, MigrationContext } from './migration-set.ts';

/**
 * An old link that still works, with the hash of its token: the token itself is never stored.
 * Expired links are left out.
 */
async function liveLink(
  collection: string,
  doc: LegacyDocument,
  { set, tally, now, tokens }: MigrationContext,
) {
  const token = text(doc, 'token');
  const student = set.student(text(doc, 'student_id'));
  const expiresAt = instant(doc, 'expires_at');
  if (token === null || student === null) {
    tally.skipped(collection, token === null ? 'missing_token' : 'student_not_found');
    return null;
  }
  if (expiresAt === null || expiresAt.getTime() <= now.getTime()) {
    tally.skipped(collection, 'expired');
    return null;
  }
  const tokenHash = await tokens.hash(token);
  return { student, expiresAt, tokenHash, id: `legacy_${tokenHash.slice(0, 24)}` };
}

/** School and homeschool family portal links: both open the family portal now. */
export const portalTokensMapper = (
  collection: 'portal_tokens' | 'homeschool_portal_tokens',
): LegacyMapper => ({
  collection,
  async map(docs, context) {
    for (const doc of docs) {
      const link = await liveLink(collection, doc, context);
      if (link === null) continue;
      const email = parseEmail('email', text(doc, 'parent_email') ?? '');
      context.set.portalLinks.push(
        createPortalLink({
          id: link.id as PortalLinkId,
          schoolId: link.student.schoolId,
          classId: link.student.classId,
          studentId: link.student.id,
          tokenHash: link.tokenHash,
          expiresAt: link.expiresAt,
          sentTo: email.ok ? email.value : null,
        }),
      );
      context.tally.imported(collection);
    }
  },
});

/** A student's learning link becomes their student link, which opens their paths and work. */
export const learningTokensMapper: LegacyMapper = {
  collection: 'student_learning_tokens',
  async map(docs, context) {
    for (const doc of docs) {
      const link = await liveLink('student_learning_tokens', doc, context);
      if (link === null) continue;
      context.set.studentLinks.push(
        createStudentLink({
          id: link.id as StudentLinkId,
          schoolId: link.student.schoolId,
          classId: link.student.classId,
          studentId: link.student.id,
          tokenHash: link.tokenHash,
          expiresAt: link.expiresAt,
        }),
      );
      context.tally.imported('student_learning_tokens');
    }
  },
};
