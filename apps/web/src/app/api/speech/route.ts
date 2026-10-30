import { z } from 'zod';
import { isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../container.ts';
import { messageFor } from '../../../server/error-messages.ts';
import { requireUser } from '../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

const body = z.object({ text: z.string().max(50_000), language: z.string(), locale: z.string() });

/**
 * Asks for text to be read aloud: the clip ids when the audio is cached, or a job to poll.
 * Signed-in teachers with AI access only; the text is never logged.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400, headers });
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : 'en';
  const { user } = await requireUser(locale, { needsAccess: false });
  const outcome = await getAppContainer().requestSpeech.execute({
    actor: user,
    text: parsed.data.text,
    language: parsed.data.language,
  });
  if (!outcome.ok) {
    return Response.json({ error: messageFor(outcome.error, locale) }, { status: 422, headers });
  }
  const { status, clips } = outcome.value;
  return Response.json(
    outcome.value.status === 'queued'
      ? { status, clips, jobId: outcome.value.job.id }
      : { status, clips },
    { headers },
  );
}
