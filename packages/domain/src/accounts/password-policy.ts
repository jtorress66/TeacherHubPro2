import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

const minimumLength = 10;
const maximumLength = 200;

/** Length-based policy (NIST 800-63B style): no composition rules, but no trivial choices. */
export function checkPassword(password: string, email: string): Result<string, ValidationError> {
  if (password.trim().length < minimumLength) return invalid('password', 'too_short');
  if (password.length > maximumLength) return invalid('password', 'too_long');
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return invalid('password', 'not_allowed');
  }
  return ok(password);
}
