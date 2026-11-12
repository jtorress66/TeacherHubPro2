import { getAppContainer } from '../../../../container.ts';
import {
  calendarHeaders,
  calendarLabels,
  calendarToken,
} from '../../../../server/calendar-feed.ts';

export const dynamic = 'force-dynamic';

const notFound = () =>
  new Response(null, { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } });

/** A teacher's calendar (plans and due dates) for calendar apps that subscribe to its link. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const token = calendarToken((await params).token);
  if (token === null) return notFound();
  const feed = await getAppContainer().readCalendarFeed.execute({
    token,
    labelsFor: calendarLabels,
  });
  if (!feed.ok) return notFound();
  return new Response(feed.value.text, { headers: calendarHeaders });
}
