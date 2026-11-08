import 'server-only';
import { headers } from 'next/headers';
import type { RateRuleName } from '@thp/domain';
import { getAppContainer } from '../../container.ts';
import { addressOf } from '../../server/chat-api.ts';

const thisMachine = new Set(['unknown', '127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * The caller's address as the proxy reports it; null when the request comes from this machine
 * (local runs and tests), where every caller would share one address.
 */
export async function callerAddress(): Promise<string | null> {
  const address = addressOf(await headers());
  return thisMachine.has(address) ? null : address;
}

/**
 * Counts one try against each named rule; `rate_limited` when any is used up. Every rule is
 * counted, so trying a different email does not reset the per-address count. A rule without a
 * subject (no address known) is not counted.
 */
export async function throttle(
  tries: readonly (readonly [RateRuleName, string | null])[],
): Promise<{ readonly code: 'rate_limited' } | null> {
  const throttled = await Promise.all(
    tries.flatMap(([rule, subject]) =>
      subject === null ? [] : [getAppContainer().throttle.execute({ rule, subject })],
    ),
  );
  return throttled.some((result) => !result.ok) ? { code: 'rate_limited' } : null;
}
