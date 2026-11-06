import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { PageIntro, TrialCta, UseCaseCards } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/use-cases',
    'marketing.useCasesPage.title',
    'marketing.useCasesPage.intro',
  );
}

/** The four audiences, each with its own page. */
export default async function UseCasesPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/use-cases">
      <PageIntro
        title={t('marketing.useCasesPage.title')}
        intro={t('marketing.useCasesPage.intro')}
      />
      <section className="m-section">
        <UseCaseCards locale={locale} />
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
