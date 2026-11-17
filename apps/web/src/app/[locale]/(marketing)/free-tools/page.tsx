import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { MarketingArt, type ArtName } from '../../../../components/marketing-art.tsx';
import { PageIntro, TrialCta } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { freeToolSlugs, type FreeToolSlug } from '../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';
import { freeToolText } from './free-tool-text.ts';
import './free-tools.css';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/free-tools',
    'marketing.freeTools.metaTitle',
    'marketing.freeTools.metaDescription',
  );
}

const art: Readonly<Record<FreeToolSlug, ArtName>> = {
  'grade-calculator': 'gradebook',
  'group-maker': 'games',
  'rubric-maker': 'assignments',
};

/** The free tools anyone can use without an account. */
export default async function FreeToolsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/free-tools">
      <PageIntro title={t('marketing.freeTools.title')} intro={t('marketing.freeTools.intro')} />
      <section className="m-section" aria-label={t('marketing.freeTools.title')}>
        <p className="notice">{t('marketing.freeTools.privacy')}</p>
        <ul className="m-grid free-tool-list">
          {freeToolSlugs.map((slug) => (
            <li key={slug} className="card m-card">
              <MarketingArt name={art[slug]} />
              <h2>
                <Link href={`/${locale}/free-tools/${slug}`}>{t(freeToolText[slug].name)}</Link>
              </h2>
              <p>{t(freeToolText[slug].summary)}</p>
            </li>
          ))}
        </ul>
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
