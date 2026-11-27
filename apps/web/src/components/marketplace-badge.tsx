import { createTranslator, type Locale } from '@thp/i18n';
import { marketplaceBadge } from '../server/marketplace-badge.ts';

/** "Get it from the Google Workspace Marketplace", linking to the listing, with Google's notice. */
export function MarketplaceBadge({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const badge = marketplaceBadge(locale);
  return (
    <div className="marketplace-badge">
      <a href={badge.href} target="_blank" rel="noopener">
        <img
          src={badge.src}
          alt={t('marketing.marketplace.badgeAlt')}
          width={badge.width}
          height={badge.height}
        />
      </a>
      <p className="marketplace-note">{t('marketing.marketplace.trademark')}</p>
    </div>
  );
}
