import type { NextRequest } from 'next/server';
import type { AssignmentId, AttachmentId, ClassId } from '@thp/domain';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** A file the teacher attached, for the teacher; anything else is a 404. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
): Promise<Response> {
  const { user } = await requireUser('en', { needsAccess: false });
  const { attachmentId } = await params;
  const search = request.nextUrl.searchParams;
  const file = await getAppContainer().getAttachmentFile.execute({
    actor: user,
    classId: (search.get('classId') ?? '') as ClassId,
    assignmentId: (search.get('assignmentId') ?? '') as AssignmentId,
    attachmentId: attachmentId as AttachmentId,
  });
  if (!file.ok) return new Response(null, { status: 404 });
  const { attachment, bytes } = file.value;
  return new Response(new Blob([bytes.slice()], { type: attachment.contentType }), {
    headers: {
      'Content-Type': attachment.contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
