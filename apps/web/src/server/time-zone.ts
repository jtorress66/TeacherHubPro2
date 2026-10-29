/** Set by the browser so "today" is the teacher's day, not the server's. */
export const TIME_ZONE_COOKIE = 'thp_tz';

/** The browser's IANA time zone when it is a real one; otherwise UTC. */
export function timeZoneFrom(value: string | undefined): string {
  if (value === undefined || value === '') return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}
