import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import type { ArtName } from '../../../../../components/marketing-art.tsx';
import { PageIntro, Points, TrialCta } from '../../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../../server/marketing-metadata.ts';
import { isUseCaseSlug, useCaseSlugs } from '../../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return useCaseSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  if (!isUseCaseSlug(slug)) return {};
  return marketingMetadata(
    await localeFrom(props),
    `/use-cases/${slug}`,
    `marketing.useCases.${slug}.title`,
    `marketing.useCases.${slug}.description`,
  );
}

const needs = ['1', '2', '3'] as const;
const art: readonly ArtName[] = ['lesson_planner', 'assignments', 'families'];

/** One audience: what it needs, and how the app helps. */
export default async function UseCasePage(props: Props) {
  const locale = await localeFrom(props);
  const { slug } = await props.params;
  if (!isUseCaseSlug(slug)) notFound();
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path={`/use-cases/${slug}`}>
      <p className="m-breadcrumb">
        <Link href={`/${locale}/use-cases`}>← {t('marketing.useCasesPage.title')}</Link>
      </p>
      <PageIntro
        title={t(`marketing.useCases.${slug}.title`)}
        intro={t(`marketing.useCases.${slug}.intro`)}
      />
      <section className="m-section">
        <Points
          items={needs.map((n) => ({
            title: t(`marketing.useCases.${slug}.n${n}Title`),
            text: t(`marketing.useCases.${slug}.n${n}Text`),
            art: art[Number(n) - 1] ?? 'check',
          }))}
        />
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
