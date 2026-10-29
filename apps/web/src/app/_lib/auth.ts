import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Authenticated } from '@thp/application';
import { sessionLifetimeDays } from '@thp/domain';
import type { Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { SESSION_COOKIE, sessionCookieOptions } from '../../server/cookies.ts';

const authenticate = cache(async (): Promise<Authenticated | 'expired' | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined) return null;
  const result = await getAppContainer().authenticate.execute(token);
  if (result.ok) return result.value;
  return result.error.code === 'session_expired' ? 'expired' : null;
});

/**
 * The signed-in teacher, their school and access, or a redirect to login. By default it also
 * sends a teacher whose trial or plan has ended to the plans page.
 */
export async function requireUser(
  locale: Locale,
  { needsAccess = true }: { readonly needsAccess?: boolean } = {},
): Promise<Authenticated> {
  const auth = await authenticate();
  if (auth === null) redirect(`/${locale}/login`);
  if (auth === 'expired') redirect(`/${locale}/login?expired=1`);
  if (needsAccess && !auth.access.hasAccess) redirect(`/${locale}/app/billing`);
  return auth;
}

export async function setSessionCookie(token: string): Promise<void> {
  const expires = new Date(Date.now() + sessionLifetimeDays * 24 * 60 * 60 * 1000);
  (await cookies()).set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(getAppContainer().appUrl, expires),
  );
}

export async function takeSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}
