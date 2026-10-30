import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** One cached audio clip, only within the teacher's school; anything else is a 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clipId: string }> },
): Promise<Response> {
  const { user } = await requireUser('en', { needsAccess: false });
  const { clipId } = await params;
  const clip = await getAppContainer().getSpeechClip.execute({ actor: user, clipId });
  if (!clip.ok) return new Response(null, { status: 404 });
  const { bytes, contentType } = clip.value;
  return new Response(new Blob([bytes.slice()], { type: contentType }), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=86400' },
  });
}
