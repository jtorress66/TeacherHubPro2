import type { JobId } from '@thp/domain';
import { isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { draftFailureMessage } from '../../../../server/planner-messages.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/**
 * A job's status for its owner to poll. Reading never changes the job, so the client may repeat
 * the request freely; anyone else's job is a 404. Only the status and a safe message are sent.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const requested = new URL(request.url).searchParams.get('locale');
  const locale = isLocale(requested) ? requested : 'en';
  const { user } = await requireUser(locale, { needsAccess: false });
  const { jobId } = await params;
  const job = await getAppContainer().getJob.execute({ actor: user, jobId: jobId as JobId });
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!job.ok) return Response.json({ error: 'not_found' }, { status: 404, headers });
  const { status, error } = job.value;
  return Response.json(
    status === 'failed' ? { status, message: draftFailureMessage(error, locale) } : { status },
    { headers },
  );
}
