import type { Result } from './shared/result.ts';

/** Test helper: returns the value of an ok result, or fails the test. */
export function valueOf<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Expected ok, got error: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Test helper: returns the error of a failed result, or fails the test. */
export function errorOf<T, E>(result: Result<T, E>): E {
  if (result.ok) throw new Error(`Expected an error, got: ${JSON.stringify(result.value)}`);
  return result.error;
}
