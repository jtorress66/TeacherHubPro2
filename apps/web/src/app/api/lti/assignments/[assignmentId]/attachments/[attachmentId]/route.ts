import type { AssignmentId, AttachmentId } from '@thp/domain';
import { getAppContainer } from '../../../../../../../container.ts';
import { passFor } from '../../../../../../_lib/lti-pass.ts';

export const dynamic = 'force-dynamic';

/** A file of the assignment a student's pass opens; anything else is a 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string; attachmentId: string }> },
): Promise<Response> {
  const { assignmentId, attachmentId } = await params;
  const app = getAppContainer();
  if (app.lti === null) return new Response(null, { status: 404 });
  const file = await app.getStudentAttachment.execute({
    pass: await passFor({ kind: 'assignment', id: assignmentId as AssignmentId }),
    attachmentId: attachmentId as AttachmentId,
  });
  if (!file.ok) return new Response(null, { status: 404 });
  const { name, contentType, bytes } = file.value;
  return new Response(new Blob([bytes.slice()], { type: contentType }), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
