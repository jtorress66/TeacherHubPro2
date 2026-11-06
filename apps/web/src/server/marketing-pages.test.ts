import { describe, expect, it } from 'vitest';
import { locales } from '@thp/i18n';
import {
  featureSlugs,
  isFeatureSlug,
  isLegalSlug,
  isUseCaseSlug,
  legalSlugs,
  marketingPaths,
  pageMetadata,
  robotsRules,
  sitemapEntries,
  useCaseSlugs,
} from './marketing-pages.ts';

const site = 'https://teacherhubpro.com';

describe('the marketing pages', () => {
  it('knows its feature, use-case and legal slugs', () => {
    expect(featureSlugs).toEqual([
      'lesson-planning',
      'gradebook',
      'attendance',
      'ai-tools',
      'presentations',
      'workflow',
    ]);
    expect(useCaseSlugs).toEqual(['classroom-teachers', 'homeschool', 'tutors', 'schools']);
    expect(legalSlugs).toContain('privacy');
    expect(isFeatureSlug('gradebook')).toBe(true);
    expect(isFeatureSlug('sso')).toBe(false);
    expect(isUseCaseSlug('tutors')).toBe(true);
    expect(isLegalSlug('soc-2')).toBe(false);
  });

  it('lists every public page', () => {
    const paths = marketingPaths();
    expect(paths).toContain('');
    expect(paths).toContain('/pricing');
    expect(paths).toContain('/features/attendance');
    expect(paths).toContain('/use-cases/schools');
    expect(paths).toContain('/ai-governance');
    expect(paths).not.toContain('/homeschool');
  });
});

describe('sitemapEntries', () => {
  it('has every page in every language, with English and Spanish alternates', () => {
    const entries = sitemapEntries(site);
    expect(entries).toHaveLength(marketingPaths().length * locales.length);
    const pricing = entries.find((e) => e.url === `${site}/es/pricing`);
    expect(pricing?.alternates).toEqual({
      en: `${site}/en/pricing`,
      es: `${site}/es/pricing`,
      'x-default': `${site}/en/pricing`,
    });
  });
});

describe('robotsRules', () => {
  it('lets crawlers read the site but not the app, private links or the API', () => {
    const rules = robotsRules(site);
    expect(rules.sitemap).toBe(`${site}/sitemap.xml`);
    expect(rules.disallow).toEqual(
      expect.arrayContaining(['/*/app', '/*/p/', '/*/s/', '/*/play', '/*/dev', '/api/']),
    );
  });
});

describe('pageMetadata', () => {
  it('gives a title, description, canonical and language alternates', () => {
    expect(pageMetadata(site, 'es', '/pricing', 'Precios', 'Planes')).toEqual({
      title: 'Precios',
      description: 'Planes',
      alternates: {
        canonical: `${site}/es/pricing`,
        languages: {
          en: `${site}/en/pricing`,
          es: `${site}/es/pricing`,
          'x-default': `${site}/en/pricing`,
        },
      },
      openGraph: {
        title: 'Precios',
        description: 'Planes',
        url: `${site}/es/pricing`,
        siteName: 'TeacherHubPro',
        type: 'website',
        locale: 'es',
      },
    });
  });
});

describe('legalSections', () => {
  it('matches the sections each legal page has in English and Spanish', async () => {
    const { catalogs } = await import('@thp/i18n');
    const { legalSections, legalPages } = await import('./marketing-pages.ts');
    for (const [slug, count] of Object.entries(legalSections)) {
      for (const language of ['en', 'es'] as const) {
        const page = catalogs[language].legal[
          legalPages[slug as keyof typeof legalPages]
        ] as unknown as Record<string, string>;
        const titles = Object.keys(page).filter((key) => /^s\d+Title$/u.test(key));
        expect(titles, `${language} ${slug}`).toHaveLength(count);
      }
    }
  });
});
