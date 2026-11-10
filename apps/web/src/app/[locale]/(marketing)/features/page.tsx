import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { FeatureGrid, PageIntro, TrialCta } from '../../../../components/marketing-sections.tsx';
import { IncludedList, StructuredData } from '../../../../components/site-facts.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { featureSlugs } from '../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/features',
    'marketing.featuresPage.metaTitle',
    'marketing.featuresPage.metaDescription',
  );
}

/** Every feature, with a card per area and links to each feature page. */
export default async function FeaturesPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/features">
      <StructuredData locale={locale} />
      <PageIntro
        title={t('marketing.featuresPage.title')}
        intro={t('marketing.featuresPage.intro')}
      />
      <section className="m-section" aria-label={t('marketing.featuresPage.allFeatures')}>
        <ul className="m-pills">
          {featureSlugs.map((slug) => (
            <li key={slug}>
              <Link href={`/${locale}/features/${slug}`}>
                {t(`marketing.features.${slug}.title`)}
              </Link>
            </li>
          ))}
          <li>
            <Link href={`/${locale}/ai`}>{t('marketing.footer.ai')}</Link>
          </li>
        </ul>
        <FeatureGrid locale={locale} />
      </section>
      <IncludedList locale={locale} />
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
