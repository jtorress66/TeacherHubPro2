import { isLocale } from '@thp/i18n';

/**
 * A cheap check for signed-out visitors of the app, before any page runs. Every app page still
 * validates the session on the server; this only spares a round trip.
 */
export function signedOutRedirect(pathname: string, hasSessionCookie: boolean): string | null {
  const [, locale, section] = pathname.split('/');
  if (hasSessionCookie || !isLocale(locale) || section !== 'app') return null;
  return `/${locale}/login`;
}
