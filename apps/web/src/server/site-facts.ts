import { planCatalog, planIds, trialDays } from '@thp/domain';
import { createTranslator, locales, type Locale } from '@thp/i18n';
import { planName, planPrice } from './plan-display.ts';

// What search engines and AI assistants read about the app: the "Everything included" list,
// structured data for search results, and /llms.txt. Prices come from the plan catalog only.

/** Every line of the "Everything included" list, as keys under `marketing.included`. */
export const includedFeatures = [
  'prepAgent',
  'planner',
  'assistant',
  'presentations',
  'tests',
  'aiGrading',
  'gradebook',
  'attendance',
  'games',
  'learning',
  'families',
  'commandCenter',
  'subPacket',
  'listen',
  'google',
  'canva',
  'microsoft',
  'teams',
  'languages',
  'privacy',
  'aiDrafts',
  'schools',
  'audiences',
] as const;

const included = (locale: Locale): string[] => {
  const t = createTranslator(locale);
  return includedFeatures.map((key) => t(`marketing.included.${key}`));
};

/** schema.org SoftwareApplication data for a page's `application/ld+json` script. */
export function softwareApplicationData(site: string, locale: Locale) {
  const t = createTranslator(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TeacherHubPro',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: `${site}/${locale}`,
    description: t('marketing.landing.metaDescription'),
    inLanguage: [...locales],
    featureList: included(locale),
    offers: planIds.map((id) => ({
      '@type': 'Offer',
      name: planName(id, locale),
      description: planPrice(id, locale),
      price: (planCatalog[id].priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
    })),
  };
}

const pages = [
  ['Features', '/features'],
  ['AI features', '/ai'],
  ['Integrations', '/integrations'],
  ['Pricing', '/pricing'],
  ['Schools and districts', '/enterprise'],
  ['Privacy and trust', '/trust'],
] as const;

/** The plain-text summary served at /llms.txt, in English. */
export function llmsText(site: string): string {
  const t = createTranslator('en');
  return [
    '# TeacherHubPro',
    '',
    `> ${t('marketing.landing.metaDescription')}`,
    '',
    `## ${t('marketing.included.title')}`,
    '',
    ...included('en').map((line) => `- ${line}`),
    '',
    '## Pricing (USD)',
    '',
    `- ${String(trialDays)}-day free trial, no payment card needed`,
    ...planIds.map((id) => `- ${planName(id, 'en')}: ${planPrice(id, 'en')}`),
    '',
    '## Pages',
    '',
    ...pages.map(([name, path]) => `- [${name}](${site}/en${path})`),
    '',
  ].join('\n');
}
