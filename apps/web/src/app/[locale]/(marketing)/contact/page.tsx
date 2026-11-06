import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { ContactForm } from '../../../../components/contact-form.tsx';
import { PageIntro } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/contact',
    'marketing.contactPage.metaTitle',
    'marketing.contactPage.metaDescription',
  );
}

export default async function ContactPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/contact">
      <PageIntro
        title={t('marketing.contactPage.title')}
        intro={t('marketing.contactPage.intro')}
      />
      <section className="m-section">
        <ContactForm locale={locale} />
      </section>
    </MarketingShell>
  );
}
