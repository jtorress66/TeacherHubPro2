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
