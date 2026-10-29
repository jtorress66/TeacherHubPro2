import type { Id } from './ids.ts';
import { ok, type Result } from './result.ts';
import { invalid, type ValidationError } from './validation.ts';

/** A 24-hour clock time, written HH:MM. */
export type TimeOfDay = Id<'TimeOfDay'>;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseTimeOfDay(field: string, value: string): Result<TimeOfDay, ValidationError> {
  return timePattern.test(value) ? ok(value as TimeOfDay) : invalid(field, 'invalid_format');
}

export function minutesOf(time: TimeOfDay): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}
