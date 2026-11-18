import { isReferralCode } from '@thp/domain';
import type { Locale } from '@thp/i18n';

/** The invite code from the link a teacher came through, kept until they make an account. */
export const REFERRAL_COOKIE = 'thp_ref';

export const referralCookieOptions = {
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
  httpOnly: true,
  sameSite: 'lax',
} as const;

export function referralFromSearch(search: URLSearchParams): string | null {
  const code = search.get('ref');
  return isReferralCode(code) ? code : null;
}

export const inviteLink = (appUrl: string, locale: Locale, code: string): string =>
  `${appUrl}/${locale}/signup?ref=${code}`;
