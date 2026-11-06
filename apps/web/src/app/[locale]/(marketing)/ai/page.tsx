import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { MarketingArt } from '../../../../components/marketing-art.tsx';
import { PageIntro, TrialCta } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/ai',
    'marketing.ai.metaTitle',
    'marketing.ai.metaDescription',
  );
}

const drafts = [
  'planner',
  'assistant',
  'slides',
  'extractor',
  'grader',
  'games',
  'paths',
  'insight',
  'prep',
] as const;
const principles = ['1', '2', '3', '4'] as const;

/** What the AI drafts and the rules it follows. */
export default async function AiPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/ai">
      <PageIntro title={t('marketing.ai.title')} intro={t('marketing.ai.intro')} />
      <section className="m-section" aria-labelledby="ai-drafts">
        <h2 id="ai-drafts">{t('marketing.ai.listTitle')}</h2>
        <ul className="m-checks">
          {drafts.map((key) => (
            <li key={key}>
              <MarketingArt name="ai_assistant" />
              {t(`marketing.ai.${key}`)}
            </li>
          ))}
        </ul>
      </section>
      <section className="m-section" aria-labelledby="ai-principles">
        <h2 id="ai-principles">{t('marketing.ai.principlesTitle')}</h2>
        <ul className="m-checks">
          {principles.map((n) => (
            <li key={n}>
              <MarketingArt name="shield" />
              {t(`marketing.ai.principle${n}`)}
            </li>
          ))}
        </ul>
        <p>
          <Link href={`/${locale}/ai-governance`}>{t('marketing.ai.governance')}</Link>
        </p>
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
