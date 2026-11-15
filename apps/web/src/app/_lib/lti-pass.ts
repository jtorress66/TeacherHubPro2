import 'server-only';
import { cookies } from 'next/headers';
import type { LtiPlacedItem } from '@thp/domain';
import { ltiPassCookie } from '../../server/lti.ts';

/**
 * The student's pass for one placed item, from its httpOnly cookie; empty (opens nothing) when
 * there is none. The pass never reaches the page's scripts.
 */
export async function passFor(item: LtiPlacedItem): Promise<string> {
  return (await cookies()).get(ltiPassCookie(item))?.value ?? '';
}
