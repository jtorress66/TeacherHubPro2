import { addDays, parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';

/** Long free text in a plan (notes, objectives, activities); short fields use the default. */
export const maxPlanTextLength = 5000;

export const longText = (field: string, value: string | null | undefined) =>
  optionalText(field, value, maxPlanTextLength);

/** The allowed values chosen, in the list's own order; anything else is an error. */
export function subsetOf<T extends string | number>(
  field: string,
  values: readonly (string | number)[] | undefined,
  allowed: readonly T[],
): Result<readonly T[], ValidationError> {
  const chosen = values ?? [];
  if (!chosen.every((value) => (allowed as readonly (string | number)[]).includes(value))) {
    return invalid(field, 'invalid_format');
  }
  return ok(allowed.filter((value) => chosen.includes(value)));
}

export function optionalDate(
  field: string,
  value: string | null | undefined,
): Result<LocalDate | null, ValidationError> {
  if (value === undefined || value === null || value.trim() === '') return ok(null);
  return parseLocalDate(field, value.trim());
}

export const isMonday = (date: LocalDate): boolean =>
  new Date(`${date}T00:00:00Z`).getUTCDay() === 1;

/** Whole days from `from` to `to`. */
export const daysBetween = (from: LocalDate, to: LocalDate): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const shiftDate = <T extends LocalDate | null>(date: T, days: number): T =>
  (date === null ? null : addDays(date, days)) as T;
