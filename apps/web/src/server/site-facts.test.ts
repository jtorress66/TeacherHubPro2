import { describe, expect, it } from 'vitest';
import { planIds } from '@thp/domain';
import { createTranslator, locales } from '@thp/i18n';
import { planPrice } from './plan-display.ts';
import { includedFeatures, llmsText, softwareApplicationData } from './site-facts.ts';

const site = 'https://teacherhubpro.com';

describe('site facts for search engines and AI assistants', () => {
  it('names every feature, Google Classroom, the languages and privacy in the included list', () => {
    const t = createTranslator('en');
    const all = includedFeatures.map((key) => t(`marketing.included.${key}`)).join('\n');
    for (const fact of [
      'Prep Agent',
      'Google Classroom',
      'Google Forms',
      'Canva',
      'PowerPoint',
      'Microsoft OneDrive',
      'Microsoft Teams',
      'live classroom games',
      'Family portal',
      'report card',
      'Chinese',
      'FERPA',
    ]) {
      expect(all).toContain(fact);
    }
  });

  it('describes the app as an education app with its features, languages and real prices', () => {
    const data = softwareApplicationData(site, 'es');
    const t = createTranslator('es');
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TeacherHubPro',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: `${site}/es`,
      inLanguage: [...locales],
      featureList: includedFeatures.map((key) => t(`marketing.included.${key}`)),
    });
    expect(data.offers.map((offer) => offer.price)).toEqual(['9.99', '79.00', '6.00', '4.00']);
    expect(data.offers.every((offer) => offer.priceCurrency === 'USD')).toBe(true);
  });

  it('gives AI assistants a plain-text summary with every feature, real prices and the main pages', () => {
    const text = llmsText(site);
    const t = createTranslator('en');
    expect(text.startsWith('# TeacherHubPro\n')).toBe(true);
    for (const key of includedFeatures) expect(text).toContain(t(`marketing.included.${key}`));
    for (const id of planIds) expect(text).toContain(planPrice(id, 'en'));
    expect(text).toContain('7-day free trial');
    for (const path of ['/en/features', '/en/pricing', '/en/integrations', '/en/ai']) {
      expect(text).toContain(`${site}${path}`);
    }
  });
});
