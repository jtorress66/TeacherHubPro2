import type { AttachmentId } from '@thp/domain';
import { getAppContainer } from '../../../../../../container.ts';

export const dynamic = 'force-dynamic';

/** A file from the student's class's assignments, opened with their link; else a 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; attachmentId: string }> },
): Promise<Response> {
  const { token, attachmentId } = await params;
  const file = await getAppContainer().getStudentAttachment.execute({
    token,
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
