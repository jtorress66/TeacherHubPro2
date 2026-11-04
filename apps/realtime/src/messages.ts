import { z } from 'zod';
import type { LiveView } from '@thp/application';

/** What a browser may send. The first message must be `hello` with its ticket. */
export const clientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), ticket: z.string().min(1).max(4096) }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('reveal') }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('remove'), playerId: z.string().min(1).max(200) }),
  z.object({
    type: z.literal('answer'),
    question: z.number().int().min(0).max(1000),
    choice: z.number().int().min(0).max(50),
  }),
]);

export type ClientMessage = z.infer<typeof clientMessage>;
export type CommandMessage = Exclude<ClientMessage, { type: 'hello' }>;

/** What the server sends: the screen's view after every change, or why a message failed. */
export type ServerMessage =
  | { readonly type: 'view'; readonly view: LiveView }
  | { readonly type: 'error'; readonly code: string; readonly field?: string };

/** The message in a frame, or null for anything malformed. */
export function readMessage(raw: string): ClientMessage | null {
  try {
    const parsed = clientMessage.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
