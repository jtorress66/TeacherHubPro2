import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { GradeCalculator } from '../../../../../components/free-tools/grade-calculator.tsx';
import { GroupMaker } from '../../../../../components/free-tools/group-maker.tsx';
import { RubricMaker } from '../../../../../components/free-tools/rubric-maker.tsx';
import { PageIntro } from '../../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../../server/marketing-metadata.ts';
import {
  freeToolSlugs,
  isFreeToolSlug,
  type FreeToolSlug,
} from '../../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';
import { freeToolText } from '../free-tool-text.ts';
import '../free-tools.css';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; tool: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return freeToolSlugs.map((tool) => ({ tool }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { tool } = await props.params;
  if (!isFreeToolSlug(tool)) return {};
  const text = freeToolText[tool];
  return marketingMetadata(
    await localeFrom(props),
    `/free-tools/${tool}`,
    text.metaTitle,
    text.metaDescription,
  );
}

const tools: Readonly<
  Record<FreeToolSlug, (props: { readonly locale: Locale }) => ReactNode>
> = {
  'grade-calculator': GradeCalculator,
  'group-maker': GroupMaker,
  'rubric-maker': RubricMaker,
};

/** One free tool: it works in the browser with no account, then invites a free trial. */
export default async function FreeToolPage(props: Props) {
  const locale = await localeFrom(props);
  const { tool } = await props.params;
  if (!isFreeToolSlug(tool)) notFound();
  const t = createTranslator(locale);
  const text = freeToolText[tool];
  const Tool = tools[tool];

  return (
    <MarketingShell locale={locale} path={`/free-tools/${tool}`}>
      <PageIntro title={t(text.name)} intro={t(text.intro)} />
      <section className="m-section" aria-label={t(text.name)}>
        <p className="notice no-print">{t('marketing.freeTools.privacy')}</p>
        <Tool locale={locale} />
      </section>
      <section className="m-section m-cta card no-print" aria-labelledby="free-cta-heading">
        <h2 id="free-cta-heading">{t('marketing.landing.ctaTitle')}</h2>
        <p>{t(text.cta)}</p>
        <p className="actions">
          <Link href={`/${locale}/signup`} className="button accent large">
            {t('marketing.nav.startTrial')}
          </Link>
          <Link href={`/${locale}/free-tools`}>{t('marketing.freeTools.more')}</Link>
        </p>
      </section>
    </MarketingShell>
  );
}
