import type { Locale } from '@thp/i18n';

/** TeacherHubPro's approved listing on the Google Workspace Marketplace. */
export const marketplaceListingUrl =
  'https://workspace.google.com/marketplace/app/teacherhubpro/248264130178';

export interface MarketplaceBadge {
  readonly href: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Google's own badge in the page's language. The files in public/brand/marketplace are Google's,
 * unchanged, as its badge guidelines require; it must always link to the listing.
 */
export const marketplaceBadge = (locale: Locale): MarketplaceBadge => ({
  href: marketplaceListingUrl,
  src: `/brand/marketplace/${locale}.svg`,
  width: 243,
  height: 40,
});
