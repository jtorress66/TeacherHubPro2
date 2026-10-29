import { ok, type Result } from './result.ts';
import { invalid, type ValidationError } from './validation.ts';

/** An optional https address (logos, profile pictures); blank means none. */
export function optionalHttpsUrl(
  field: string,
  value: string | null | undefined,
): Result<string | null, ValidationError> {
  const text = value?.trim() ?? '';
  if (text === '') return ok(null);
  return URL.canParse(text) && new URL(text).protocol === 'https:'
    ? ok(text)
    : invalid(field, 'invalid_format');
}
