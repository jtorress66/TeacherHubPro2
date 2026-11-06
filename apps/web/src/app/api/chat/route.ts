import { getAppContainer } from '../../../container.ts';
import { chatTokenOf, startChatBody, visitorOf } from '../../../server/chat-api.ts';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

/** Opens a chat with the website assistant; the reply carries the chat's secret token. */
export async function POST(request: Request): Promise<Response> {
  const body = startChatBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid' }, { status: 400, headers: noStore });
  const started = await getAppContainer().startChat.execute({
    ...body.data,
    visitor: visitorOf(request),
  });
  if (!started.ok) return Response.json({ error: 'failed' }, { status: 400, headers: noStore });
  return Response.json({ token: started.value.token }, { headers: noStore });
}

/** The chat so far, for the widget to poll; only the holder of the token can read it. */
export async function GET(request: Request): Promise<Response> {
  const chat = await getAppContainer().getChat.execute({ token: chatTokenOf(request) });
  if (!chat.ok) return Response.json({ error: 'not_found' }, { status: 404, headers: noStore });
  return Response.json(
    {
      turns: chat.value.map((turn) => ({
        id: turn.id,
        message: turn.message,
        reply: turn.reply,
        status: turn.status,
      })),
    },
    { headers: noStore },
  );
}
