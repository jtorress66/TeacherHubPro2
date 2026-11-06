import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { Faq, PageIntro } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/help',
    'marketing.helpPage.metaTitle',
    'marketing.helpPage.metaDescription',
  );
}

const steps = ['1', '2', '3', '4'] as const;
const faqNumbers = ['1', '2', '3', '4'] as const;

/** Getting started, and answers to common questions. */
export default async function HelpPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/help">
      <PageIntro title={t('marketing.helpPage.title')} intro={t('marketing.helpPage.intro')} />
      <section className="m-section" aria-labelledby="help-start">
        <h2 id="help-start">{t('marketing.helpPage.startTitle')}</h2>
        <ol className="m-numbered">
          {steps.map((n) => (
            <li key={n}>{t(`marketing.helpPage.step${n}`)}</li>
          ))}
        </ol>
        <p>
          <Link href={`/${locale}/signup`} className="button accent">
            {t('marketing.nav.startTrial')}
          </Link>
        </p>
      </section>
      <Faq
        title={t('marketing.helpPage.faqTitle')}
        items={faqNumbers.map((n) => ({
          q: t(`marketing.helpPage.faq${n}Q`),
          a: t(`marketing.helpPage.faq${n}A`),
        }))}
      />
    </MarketingShell>
  );
}
