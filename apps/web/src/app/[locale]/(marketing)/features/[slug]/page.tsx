import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import type { ArtName } from '../../../../../components/marketing-art.tsx';
import { PageIntro, Points, TrialCta } from '../../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../../server/marketing-metadata.ts';
import {
  featureSlugs,
  isFeatureSlug,
  type FeatureSlug,
} from '../../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return featureSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  if (!isFeatureSlug(slug)) return {};
  return marketingMetadata(
    await localeFrom(props),
    `/features/${slug}`,
    `marketing.features.${slug}.title`,
    `marketing.features.${slug}.description`,
  );
}

const art: Readonly<Record<FeatureSlug, readonly [ArtName, ArtName, ArtName, ArtName]>> = {
  'lesson-planning': ['lesson_planner', 'ai_assistant', 'check', 'command_center'],
  gradebook: ['gradebook', 'check', 'lesson_planner', 'shield'],
  attendance: ['attendance', 'lock', 'gradebook', 'command_center'],
  'ai-tools': ['ai_assistant', 'assignments', 'check', 'learning'],
  presentations: ['presentations', 'ai_assistant', 'gradebook', 'link'],
  workflow: ['schools', 'command_center', 'families', 'prep_agent'],
};

const points = ['1', '2', '3', '4'] as const;

/** One feature area: what it does, in four points. */
export default async function FeaturePage(props: Props) {
  const locale = await localeFrom(props);
  const { slug } = await props.params;
  if (!isFeatureSlug(slug)) notFound();
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path={`/features/${slug}`}>
      <p className="m-breadcrumb">
        <Link href={`/${locale}/features`}>← {t('marketing.featuresPage.allFeatures')}</Link>
      </p>
      <PageIntro
        title={t(`marketing.features.${slug}.title`)}
        intro={t(`marketing.features.${slug}.intro`)}
      />
      <section className="m-section">
        <Points
          items={points.map((n) => ({
            title: t(`marketing.features.${slug}.p${n}Title`),
            text: t(`marketing.features.${slug}.p${n}Text`),
            art: art[slug][Number(n) - 1] ?? 'check',
          }))}
        />
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
