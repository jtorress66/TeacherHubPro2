import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Authenticated, SignInBrowser, SignInStep } from '@thp/application';
import { sessionLifetimeDays } from '@thp/domain';
import type { Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { SESSION_COOKIE, sessionCookieOptions } from '../../server/cookies.ts';
import {
  confirmSignInPath,
  SIGN_IN_CONFIRM_COOKIE,
  signInConfirmCookieOptions,
} from '../../server/sign-in-confirm.ts';

type SignedOut = 'expired' | 'suspended' | 'replaced';

const signedOutBy: Readonly<Record<string, SignedOut>> = {
  account_suspended: 'suspended',
  session_expired: 'expired',
  session_replaced: 'replaced',
};

const authenticate = cache(async (): Promise<Authenticated | SignedOut | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined) return null;
  const result = await getAppContainer().authenticate.execute(token);
  if (result.ok) return result.value;
  return signedOutBy[result.error.code] ?? null;
});

/** The signed-in person, or null (signed out, expired or suspended); never redirects. */
export async function currentUser(): Promise<Authenticated | null> {
  const auth = await authenticate();
  return typeof auth === 'object' ? auth : null;
}

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
  if (auth === 'suspended') redirect(`/${locale}/login?error=account_suspended`);
  // Signed in on another device: say so, so someone who did not do it can change the password.
  if (auth === 'replaced') redirect(`/${locale}/login?replaced=1`);
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

/** This browser, as a sign-in sees it: its current session cookie and its user agent. */
export async function signInBrowser(): Promise<SignInBrowser> {
  return {
    sessionToken: (await cookies()).get(SESSION_COOKIE)?.value ?? null,
    userAgent: (await headers()).get('user-agent'),
  };
}

/**
 * Finishes a sign-in: sets the session cookie, or (the account is in use on another device) keeps
 * the signed ticket and returns the confirmation page to go to instead of `next`.
 */
export async function landSignIn(step: SignInStep, locale: Locale, next: string): Promise<string> {
  if (step.kind === 'signedIn') {
    await setSessionCookie(step.sessionToken);
    return next;
  }
  (await cookies()).set(
    SIGN_IN_CONFIRM_COOKIE,
    step.ticket,
    signInConfirmCookieOptions(getAppContainer().appUrl),
  );
  return confirmSignInPath(locale, next);
}
