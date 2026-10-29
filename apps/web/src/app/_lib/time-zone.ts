import 'server-only';
import { cookies } from 'next/headers';
import { TIME_ZONE_COOKIE, timeZoneFrom } from '../../server/time-zone.ts';

/** The teacher's time zone, as their browser reported it (UTC until it has). */
export async function teacherTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return timeZoneFrom(value === undefined ? undefined : decodeURIComponent(value));
}
