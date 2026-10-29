import { defaultLocale, isLocale, type Locale } from '@thp/i18n';

export const SESSION_COOKIE = 'thp_session';
export const OAUTH_STATE_COOKIE = 'thp_oauth_state';

const secureFor = (appUrl: string) => appUrl.startsWith('https://');

export const sessionCookieOptions = (appUrl: string, expires: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: secureFor(appUrl),
  path: '/',
  expires,
});

/** The Google sign-in round trip must finish within ten minutes. */
export const oauthStateCookieOptions = (appUrl: string) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: secureFor(appUrl),
  path: '/',
  maxAge: 600,
});

/** The random state (checked on return, against forged callbacks) and the page language. */
export const encodeOAuthState = (state: string, locale: Locale): string => `${state}.${locale}`;

export function decodeOAuthState(
  value: string | undefined,
): { state: string; locale: Locale } | null {
  const separator = value?.lastIndexOf('.') ?? -1;
  if (value === undefined || separator <= 0) return null;
  const locale = value.slice(separator + 1);
  return { state: value.slice(0, separator), locale: isLocale(locale) ? locale : defaultLocale };
}
