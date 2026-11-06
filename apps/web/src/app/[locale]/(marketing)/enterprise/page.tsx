import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import type { ArtName } from '../../../../components/marketing-art.tsx';
import { PageIntro, PlanCards, Points } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/enterprise',
    'marketing.enterprisePage.metaTitle',
    'marketing.enterprisePage.metaDescription',
  );
}

const points = ['1', '2', '3', '4'] as const;
const art: readonly ArtName[] = ['schools', 'assignments', 'shield', 'gradebook'];

/** Schools and districts: admin pages, bulk import, privacy and per-teacher plans. */
export default async function EnterprisePage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/enterprise">
      <PageIntro
        title={t('marketing.enterprisePage.title')}
        intro={t('marketing.enterprisePage.intro')}
      />
      <section className="m-section">
        <Points
          items={points.map((n) => ({
            title: t(`marketing.enterprisePage.p${n}Title`),
            text: t(`marketing.enterprisePage.p${n}Text`),
            art: art[Number(n) - 1] ?? 'check',
          }))}
        />
      </section>
      <section className="m-section">
        <PlanCards locale={locale} full />
        <p className="m-actions">
          <Link href={`/${locale}/contact`} className="button accent large">
            {t('marketing.enterprisePage.cta')}
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}
