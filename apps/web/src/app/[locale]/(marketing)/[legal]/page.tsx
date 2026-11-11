import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import {
  isLegalSlug,
  legalPages,
  legalSections,
  legalSlugs,
} from '../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; legal: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return legalSlugs.map((legal) => ({ legal }));
}

/** When the legal pages' wording last changed. */
const updated = '2026-11-11';

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { legal } = await props.params;
  if (!isLegalSlug(legal)) return {};
  const key = legalPages[legal];
  return marketingMetadata(
    await localeFrom(props),
    `/${legal}`,
    `legal.${key}.title`,
    `legal.${key}.description`,
  );
}

/** A legal or trust page, from the `legal` strings. */
export default async function LegalPage(props: Props) {
  const locale = await localeFrom(props);
  const { legal } = await props.params;
  if (!isLegalSlug(legal)) notFound();
  const key = legalPages[legal];
  const t = createTranslator(locale);
  /** Section keys are checked by the catalog test that every listed section exists. */
  const page = t as (key: string) => string;
  const present = Array.from({ length: legalSections[legal] }, (_, i) => i + 1);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${updated}T00:00:00Z`),
  );
  return (
    <MarketingShell locale={locale} path={`/${legal}`}>
      <article className="m-section m-legal">
        <h1>{t(`legal.${key}.title`)}</h1>
        <p className="muted">{t('legal.updated', { date })}</p>
        {present.map((n) => (
          <section key={n}>
            <h2>{page(`legal.${key}.s${String(n)}Title`)}</h2>
            <p>{page(`legal.${key}.s${String(n)}Text`)}</p>
          </section>
        ))}
        <p className="hint">{t('legal.contact')}</p>
      </article>
    </MarketingShell>
  );
}
