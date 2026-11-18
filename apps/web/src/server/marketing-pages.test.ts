import { describe, expect, it } from 'vitest';
import { locales } from '@thp/i18n';
import {
  featureSlugs,
  freeToolSlugs,
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
  it('knows its free tools', () => {
    expect(freeToolSlugs).toEqual(['grade-calculator', 'group-maker', 'rubric-maker']);
  });

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
    expect(paths).toEqual(
      expect.arrayContaining([
        '/free-tools',
        '/free-tools/grade-calculator',
        '/free-tools/group-maker',
        '/free-tools/rubric-maker',
      ]),
    );
    expect(paths).toContain('/use-cases/schools');
    expect(paths).toContain('/ai-governance');
    expect(paths).toContain('/school-privacy');
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
      expect.arrayContaining([
        '/*/app',
        '/*/p/',
        '/*/s/',
        '/*/play',
        '/*/dev',
        '/*/set-password',
        '/*/confirm-email',
        '/api/',
      ]),
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

describe('the school privacy page', () => {
  it('states the agreement, where data is kept, the breach notice and the privacy email', async () => {
    const { catalogs } = await import('@thp/i18n');
    const text = Object.values(catalogs.en.legal.schoolPrivacy).join(' ');
    expect(text).toContain('National Data Privacy Agreement');
    expect(text).toContain('Virginia, USA');
    expect(text).toContain('72 hours');
    expect(text).toContain('privacy@teacherhubpro.com');
    for (const provider of [
      'Render',
      'Stripe',
      'Anthropic',
      'OpenAI',
      'Google',
      'Canva',
      'Microsoft',
    ]) {
      expect(text).toContain(provider);
    }
  });

  it('is pointed to from the trust center in every language', async () => {
    const { catalogs, locales } = await import('@thp/i18n');
    for (const locale of locales) {
      expect(catalogs[locale].legal.trust.s5Text, locale).toContain('privacy@teacherhubpro.com');
    }
  });
});
