import { invalid, ok, type Result, type ValidationError } from '@thp/domain';

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** How far a time zone is ahead of UTC at a moment, in milliseconds. */
function offsetAt(moment: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(moment));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wall - moment;
}

/**
 * "Post now" (no time), or "Schedule" with the date and time the teacher picked, read in their
 * time zone. The use case checks the moment is in the allowed range.
 */
export function scheduledAtOf(
  data: FormData,
  timeZone: string,
): Result<Date | null, ValidationError> {
  if (field(data, 'when') !== 'later') return ok(null);
  const date = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(field(data, 'scheduleDate'));
  const time = /^(\d{2}):(\d{2})$/u.exec(field(data, 'scheduleTime'));
  if (date === null || time === null) return invalid('scheduledAt', 'required');
  const wall = Date.UTC(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    Number(time[1]),
    Number(time[2]),
  );
  // Twice, so a time near a daylight-saving change uses the offset of the moment itself.
  const first = wall - offsetAt(wall, timeZone);
  return ok(new Date(wall - offsetAt(first, timeZone)));
}
