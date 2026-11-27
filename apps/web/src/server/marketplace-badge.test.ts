import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { locales } from '@thp/i18n';
import { describe, expect, it } from 'vitest';
import { marketplaceBadge, marketplaceListingUrl } from './marketplace-badge.ts';

const publicFile = (src: string): string =>
  fileURLToPath(new URL(`../../public${src}`, import.meta.url));

describe('marketplaceBadge', () => {
  it('links to the TeacherHubPro listing on the Google Workspace Marketplace', () => {
    expect(marketplaceListingUrl).toBe(
      'https://workspace.google.com/marketplace/app/teacherhubpro/248264130178',
    );
    expect(marketplaceBadge('es').href).toBe(marketplaceListingUrl);
  });

  it('shows Google’s badge in the page’s language', () => {
    expect(marketplaceBadge('es').src).toBe('/brand/marketplace/es.svg');
    expect(marketplaceBadge('zh').src).toBe('/brand/marketplace/zh.svg');
  });

  it('has Google’s badge file for every language', () => {
    for (const locale of locales) {
      expect(existsSync(publicFile(marketplaceBadge(locale).src)), locale).toBe(true);
    }
  });

  it('keeps the badge’s own proportions', () => {
    const { width, height } = marketplaceBadge('en');
    expect(width / height).toBeCloseTo(417.14 / 68.57, 1);
  });
});
