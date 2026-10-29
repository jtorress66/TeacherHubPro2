import type { Result } from '@thp/domain';

/** Returns the value of an ok result. A failure here is a bug in the test setup. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Test setup failed: ${JSON.stringify(result.error)}`);
  return result.value;
}
