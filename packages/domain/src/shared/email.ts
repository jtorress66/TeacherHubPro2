import type { Id } from './ids.ts';
import { ok, type Result } from './result.ts';
import { invalid, type ValidationError } from './validation.ts';

export type Email = Id<'Email'>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(
  field: string,
  value: string | undefined,
): Result<Email, ValidationError> {
  const email = value?.trim().toLowerCase() ?? '';
  if (email === '') return invalid(field, 'required');
  if (email.length > 254 || !emailPattern.test(email)) return invalid(field, 'invalid_format');
  return ok(email as Email);
}

/** Like parseEmail, but blank or missing means no email. */
export function parseOptionalEmail(
  field: string,
  value: string | null | undefined,
): Result<Email | null, ValidationError> {
  return value == null || value.trim() === '' ? ok(null) : parseEmail(field, value);
}
