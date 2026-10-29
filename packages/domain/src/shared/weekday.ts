import { ok, type Result } from './result.ts';
import { invalid, type ValidationError } from './validation.ts';

export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type Weekday = (typeof weekdays)[number];

export const defaultSchoolDays: readonly Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const isWeekday = (value: string): value is Weekday =>
  (weekdays as readonly string[]).includes(value);

/** Validates a list of days and returns it in week order; missing means Mon–Fri. */
export function parseWeekdays(
  field: string,
  values: readonly string[] | undefined,
): Result<readonly Weekday[], ValidationError> {
  if (values === undefined) return ok(defaultSchoolDays);
  if (values.length === 0) return invalid(field, 'required');
  if (!values.every(isWeekday)) return invalid(field, 'invalid_format');
  if (new Set(values).size !== values.length) return invalid(field, 'duplicate');
  return ok(weekdays.filter((day) => values.includes(day)));
}
