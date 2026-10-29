import { err, ok, type Err, type Result } from './result.ts';

export type ValidationCode =
  | 'required'
  | 'invalid_format'
  | 'out_of_range'
  | 'too_short'
  | 'too_long'
  | 'not_allowed'
  | 'duplicate'
  | 'invalid_order';

export interface ValidationError {
  readonly field: string;
  readonly code: ValidationCode;
}

export const invalid = (field: string, code: ValidationCode): Err<ValidationError> =>
  err({ field, code });

const defaultMaxLength = 200;

/** Trims the value; blank or over-long text is an error. */
export function requiredText(
  field: string,
  value: string | undefined,
  maxLength = defaultMaxLength,
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
  maxLength = defaultMaxLength,
): Result<string | null, ValidationError> {
  const text = value?.trim() ?? '';
  if (text === '') return ok(null);
  if (text.length > maxLength) return invalid(field, 'too_long');
  return ok(text);
}
