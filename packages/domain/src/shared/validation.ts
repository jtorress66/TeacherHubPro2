import { err, ok, type Err, type Result } from './result.ts';

export type ValidationCode =
  | 'required'
  | 'invalid_format'
  | 'out_of_range'
  | 'too_short'
  | 'too_long'
  | 'too_large'
  | 'not_allowed'
  | 'duplicate'
  | 'invalid_order';

/** The smallest and largest whole number a field accepts. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

export interface ValidationError {
  readonly field: string;
  readonly code: ValidationCode;
  /** For a number outside its range: the range, so the message can name it. */
  readonly range?: NumberRange;
}

export const invalid = (field: string, code: ValidationCode): Err<ValidationError> =>
  err({ field, code });

/** A number outside the range it must be in; the error carries the range. */
export const outOfRange = (field: string, range: NumberRange): Err<ValidationError> =>
  err({ field, code: 'out_of_range', range: { min: range.min, max: range.max } });

/** Whether a value is a whole number inside the range. */
export const isWholeNumberIn = (value: number, range: NumberRange): boolean =>
  Number.isInteger(value) && value >= range.min && value <= range.max;

/** The longest a short text (a name, a title, a theme) may be. */
export const maxShortTextLength = 200;

/** Trims the value; blank or over-long text is an error. */
export function requiredText(
  field: string,
  value: string | undefined,
  maxLength = maxShortTextLength,
): Result<string, ValidationError> {
  const text = value?.trim() ?? '';
  if (text === '') return invalid(field, 'required');
  if (text.length > maxLength) return invalid(field, 'too_long');
  return ok(text);
}

/** Trims the value; blank or missing text becomes null. */
export function optionalText(
  field: string,
  value: string | null | undefined,
  maxLength = maxShortTextLength,
): Result<string | null, ValidationError> {
  const text = value?.trim() ?? '';
  if (text === '') return ok(null);
  if (text.length > maxLength) return invalid(field, 'too_long');
  return ok(text);
}
