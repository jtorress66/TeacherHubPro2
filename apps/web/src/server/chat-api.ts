import { z } from 'zod';

// Request shapes for the website chat's API. Only the shape is checked here; the use cases check
// the rules.

export const startChatBody = z.object({
  role: z.string().max(40),
  interest: z.string().max(40),
  locale: z.string().max(5),
  page: z.string().max(300).nullable(),
});

export const sendChatBody = z.object({ message: z.string().max(4000) });

/** The visitor's address, for the hourly limit: the first proxy hop, as Render sets it. */
export function visitorOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  return forwarded === '' ? 'unknown' : forwarded;
}

/** The chat's secret, sent in a header so it never appears in an address or a log line. */
export const chatTokenOf = (request: Request): string =>
  request.headers.get('x-chat-token')?.trim() ?? '';
