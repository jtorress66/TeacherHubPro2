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
    expect(paths).not.toContain('/school-privacy');
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

describe('the privacy policy', () => {
  it('is the one privacy page: the agreement, where data is kept, the breach notice and the privacy email', async () => {
    const { catalogs } = await import('@thp/i18n');
    const text = Object.values(catalogs.en.legal.privacy).join(' ');
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

  it('names the Settings buttons that download or delete a school’s data, in every language', async () => {
    const { catalogs, locales } = await import('@thp/i18n');
    for (const locale of locales) {
      const catalog = catalogs[locale];
      const keeping = catalog.legal.privacy.s7Text;
      expect(keeping, locale).toContain(catalog.schoolExport.title);
      expect(keeping, locale).toContain(catalog.schoolDeletion.title);
      expect(keeping, locale).toContain(catalog.nav.settings);
    }
  });

  it('is pointed to from the trust center in every language', async () => {
    const { catalogs, locales } = await import('@thp/i18n');
    for (const locale of locales) {
      expect(catalogs[locale].legal.trust.s5Text, locale).toContain('privacy@teacherhubpro.com');
    }
  });
});

describe('the accessibility statement', () => {
  it('names the standard, offers the report, and is honest about what is not done yet', async () => {
    const { catalogs } = await import('@thp/i18n');
    const text = Object.values(catalogs.en.legal.accessibility).join(' ');
    expect(text).toContain('WCAG 2.1 level AA');
    expect(text).toContain('accessibility report (VPAT)');
    expect(text).toContain('not yet tagged for screen readers');
    // The site is always dark on screen: it does not follow a light or dark setting.
    expect(text).not.toContain('light or dark setting');
  });
});

describe('the AI governance page', () => {
  it('says the AI providers do not train on what we send and keep it at most 30 days', async () => {
    const { catalogs, locales } = await import('@thp/i18n');
    expect(catalogs.en.legal.aiGovernance.s5Text).toContain('do not use what we send them to train their models');
    for (const locale of locales) {
      expect(catalogs[locale].legal.aiGovernance.s5Text, locale).toContain('30');
    }
  });
});
