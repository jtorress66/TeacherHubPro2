import { locales, type Locale } from '@thp/i18n';

// The public site's pages, for routing, the sitemap and search-engine metadata.

export const featureSlugs = [
  'lesson-planning',
  'gradebook',
  'attendance',
  'ai-tools',
  'presentations',
  'workflow',
] as const;
export type FeatureSlug = (typeof featureSlugs)[number];

export const useCaseSlugs = ['classroom-teachers', 'homeschool', 'tutors', 'schools'] as const;
export type UseCaseSlug = (typeof useCaseSlugs)[number];

/** Each legal page's path and its key in the `legal` catalog group. */
export const legalPages = {
  privacy: 'privacy',
  terms: 'terms',
  cookies: 'cookies',
  accessibility: 'accessibility',
  'acceptable-use': 'acceptableUse',
  ferpa: 'ferpa',
  coppa: 'coppa',
  'ai-governance': 'aiGovernance',
  trust: 'trust',
} as const;
export type LegalSlug = keyof typeof legalPages;

/** How many titled sections each legal page has in the catalogs. */
export const legalSections: Readonly<Record<LegalSlug, number>> = {
  privacy: 6,
  terms: 6,
  cookies: 3,
  accessibility: 3,
  'acceptable-use': 3,
  ferpa: 3,
  coppa: 3,
  'ai-governance': 5,
  trust: 5,
};
export const legalSlugs = Object.keys(legalPages) as LegalSlug[];

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (value: string): value is T =>
    (list as readonly string[]).includes(value);

export const isFeatureSlug = oneOf(featureSlugs);
export const isUseCaseSlug = oneOf(useCaseSlugs);
export const isLegalSlug = oneOf(legalSlugs);

const staticPaths = [
  '',
  '/features',
  '/ai',
  '/use-cases',
  '/pricing',
  '/integrations',
  '/enterprise',
  '/contact',
  '/help',
];

/** Every public page's path after the language, e.g. "/pricing" ("" is the home page). */
export const marketingPaths = (): string[] => [
  ...staticPaths,
  ...featureSlugs.map((slug) => `/features/${slug}`),
  ...useCaseSlugs.map((slug) => `/use-cases/${slug}`),
  ...legalSlugs.map((slug) => `/${slug}`),
];

/** The fully translated languages, offered to search engines as alternates. */
const alternateLocales: readonly Locale[] = ['en', 'es'];

const languageAlternates = (site: string, path: string) => ({
  ...Object.fromEntries(alternateLocales.map((l) => [l, `${site}/${l}${path}`])),
  'x-default': `${site}/en${path}`,
});

export interface SitemapEntry {
  readonly url: string;
  readonly alternates: Readonly<Record<string, string>>;
}

export const sitemapEntries = (site: string): SitemapEntry[] =>
  marketingPaths().flatMap((path) =>
    locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      alternates: languageAlternates(site, path),
    })),
  );

/** Crawlers may read the public site, but not the app, private links, live games or the API. */
export const robotsRules = (site: string) => ({
  allow: '/',
  disallow: [
    '/*/app',
    '/*/p/',
    '/*/s/',
    '/*/play',
    '/*/dev',
    '/*/set-password',
    '/*/confirm-email',
    '/api/',
  ],
  sitemap: `${site}/sitemap.xml`,
});

/** A page's title, description, canonical address, language alternates and sharing card. */
export const pageMetadata = (
  site: string,
  locale: Locale,
  path: string,
  title: string,
  description: string,
) => ({
  title,
  description,
  alternates: {
    canonical: `${site}/${locale}${path}`,
    languages: languageAlternates(site, path),
  },
  openGraph: {
    title,
    description,
    url: `${site}/${locale}${path}`,
    siteName: 'TeacherHubPro',
    type: 'website' as const,
    locale,
  },
});
