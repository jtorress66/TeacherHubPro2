import { getAppContainer } from '../../../../container.ts';
import { chatTokenOf, sendChatBody, visitorOf } from '../../../../server/chat-api.ts';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

/** Queues a visitor's message for the assistant; the worker answers it. */
export async function POST(request: Request): Promise<Response> {
  const body = sendChatBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid' }, { status: 400, headers: noStore });
  const sent = await getAppContainer().sendChatMessage.execute({
    token: chatTokenOf(request),
    message: body.data.message,
    visitor: visitorOf(request),
  });
  if (sent.ok) return Response.json({ turnId: sent.value.turnId }, { headers: noStore });
  const error = 'field' in sent.error ? sent.error.field : sent.error.code;
  const status = error === 'not_found' ? 404 : error === 'rate_limited' ? 429 : 400;
  return Response.json({ error }, { status, headers: noStore });
}
