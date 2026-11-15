import type { SignInConfirmation, UseCaseError } from '@thp/application';
import type { DeviceKeys } from '@thp/domain';
import { createTranslator, defaultLocale, isLocale, type Locale } from '@thp/i18n';

/**
 * The signed ticket of a sign-in waiting for "Continue here" (the account is in use on another
 * device). It lasts as long as the ticket, five minutes.
 */
export const SIGN_IN_CONFIRM_COOKIE = 'thp_sign_in_confirm';

export const signInConfirmCookieOptions = (appUrl: string) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: appUrl.startsWith('https://'),
  path: '/',
  maxAge: 300,
});

const insideApp = /^\/([a-z]{2})(?:[/?][^\\\s]*)?$/u;

/** Why a waiting sign-in could not go on, for the log in page: suspended, or simply too late. */
export const signInProblem = (error: UseCaseError | undefined): string =>
  error?.code === 'account_suspended' ? 'account_suspended' : 'sign_in_expired';

/** A path inside this site to go on to after signing in, or null for anything else. */
export function safeNextPath(value: string | null): string | null {
  if (value === null) return null;
  const match = insideApp.exec(value);
  if (match === null || !isLocale(match[1]) || value.includes('//')) return null;
  return value;
}

/** The language a path inside the site is in. */
export function localeOfPath(path: string): Locale {
  const segment = path.split('/')[1];
  return isLocale(segment) ? segment : defaultLocale;
}

/** The "already signed in on another device" page, then on to `next`. */
export const confirmSignInPath = (locale: Locale, next: string): string =>
  `/${locale}/login/confirm?${new URLSearchParams({ next }).toString()}`;

/** "Chrome on Windows", in the page language. */
export function deviceLabel(locale: Locale, device: DeviceKeys): string {
  const t = createTranslator(locale);
  return t('devices.label', {
    browser: t(`devices.browser_${device.browser}`),
    os: t(`devices.os_${device.os}`),
  });
}

/** "5 minutes ago" (or "just now"), in the page language. */
function activeWhen(locale: Locale, minutesAgo: number): string {
  if (minutesAgo < 1) return createTranslator(locale)('signInConfirm.justNow');
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-minutesAgo, 'minute');
}

/** The warning on the confirmation page. */
export function confirmMessage(locale: Locale, confirmation: SignInConfirmation): string {
  const t = createTranslator(locale);
  const when = activeWhen(locale, confirmation.minutesAgo);
  return confirmation.device === null
    ? t('signInConfirm.bodyUnknownDevice', { when })
    : t('signInConfirm.body', { device: deviceLabel(locale, confirmation.device), when });
}
