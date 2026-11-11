import type { Id } from './ids.ts';
import { ok, type Result } from './result.ts';
import { invalid, type ValidationError } from './validation.ts';

/** A calendar date without time or zone, written YYYY-MM-DD. */
export type LocalDate = Id<'LocalDate'>;

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(field: string, value: string): Result<LocalDate, ValidationError> {
  const match = datePattern.exec(value);
  if (match === null) return invalid(field, 'invalid_format');
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? ok(value as LocalDate) : invalid(field, 'invalid_format');
}

/** Negative when `a` is earlier, positive when later, 0 when equal. */
export const compareDates = (a: LocalDate, b: LocalDate): number => a.localeCompare(b);

const dayInMs = 24 * 60 * 60 * 1000;

/** The date `days` days after `date` (before it when negative). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const time = Date.parse(`${date}T00:00:00Z`) + days * dayInMs;
  return new Date(time).toISOString().slice(0, 10) as LocalDate;
}

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
 * The instant a wall clock in a time zone shows `hours:minutes` on `date`; an unknown zone counts
 * as UTC.
 */
export function instantIn(date: LocalDate, hours: number, minutes: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  try {
    // Twice, so a time near a daylight-saving change uses the offset of the moment itself.
    const first = wall - offsetAt(wall, timeZone);
    return new Date(wall - offsetAt(first, timeZone));
  } catch {
    return new Date(wall);
  }
}

/** The calendar date of an instant in a time zone; an unknown zone counts as UTC. */
export function localDateIn(instant: Date, timeZone: string): LocalDate {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant) as LocalDate;
  try {
    return format(timeZone);
  } catch {
    return format('UTC');
  }
}
