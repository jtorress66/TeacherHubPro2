import type { Metadata } from 'next';
import Link from 'next/link';
import { trialDays } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { Faq, PageIntro, PlanCards } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/pricing',
    'marketing.pricingPage.metaTitle',
    'marketing.pricingPage.metaDescription',
  );
}

const faqNumbers = ['1', '2', '3'] as const;

/** Every plan with its price from the plan catalog, the trial, and pricing questions. */
export default async function PricingPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/pricing">
      <PageIntro
        title={t('marketing.pricingPage.title')}
        intro={t('marketing.pricingPage.intro', { days: trialDays })}
      />
      <section className="m-section">
        <PlanCards locale={locale} full />
        <p className="m-actions">
          <Link href={`/${locale}/signup`} className="button accent large">
            {t('marketing.pricingPage.start')}
          </Link>{' '}
          <Link href={`/${locale}/contact`} className="button secondary">
            {t('marketing.pricingPage.contactSales')}
          </Link>
        </p>
      </section>
      <Faq
        title={t('marketing.pricingPage.faqTitle')}
        items={faqNumbers.map((n) => ({
          q: t(`marketing.pricingPage.faq${n}Q`),
          a: t(`marketing.pricingPage.faq${n}A`),
        }))}
      />
    </MarketingShell>
  );
}
