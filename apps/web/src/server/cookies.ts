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

export const CANVA_OAUTH_COOKIE = 'thp_canva_oauth';
export const MICROSOFT_OAUTH_COOKIE = 'thp_microsoft_oauth';

/**
 * Connecting Canva or Microsoft (each under its own cookie): the random state, the PKCE verifier
 * (kept here, never sent until the code comes back) and the page language. Neither random value
 * contains a dot. Connecting Microsoft also remembers whether Teams was asked for.
 */
export const encodePkceOAuth = (value: {
  readonly state: string;
  readonly verifier: string;
  readonly locale: Locale;
  readonly teams?: boolean;
}): string =>
  `${value.state}.${value.verifier}.${value.locale}${value.teams === true ? '.teams' : ''}`;

export function decodePkceOAuth(
  value: string | undefined,
): { state: string; verifier: string; locale: Locale; teams: boolean } | null {
  const [state, verifier, locale, ...rest] = (value ?? '').split('.');
  if (state === undefined || state === '' || verifier === undefined || verifier === '') return null;
  if (locale === undefined || rest.length > 1) return null;
  if (rest.length === 1 && rest[0] !== 'teams') return null;
  return {
    state,
    verifier,
    locale: isLocale(locale) ? locale : defaultLocale,
    teams: rest.length === 1,
  };
}
