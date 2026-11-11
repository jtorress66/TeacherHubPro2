import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { PageIntro, Points, TrialCta } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/integrations',
    'marketing.integrationsPage.metaTitle',
    'marketing.integrationsPage.metaDescription',
  );
}

/** Only the services the app really works with today. */
export default async function IntegrationsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/integrations">
      <PageIntro
        title={t('marketing.integrationsPage.title')}
        intro={t('marketing.integrationsPage.intro')}
      />
      <section className="m-section">
        <Points
          items={[
            {
              title: t('marketing.integrationsPage.googleSignIn'),
              text: t('marketing.integrationsPage.googleSignInText'),
              art: 'lock',
            },
            {
              title: t('marketing.integrationsPage.classroom'),
              text: t('marketing.integrationsPage.classroomText'),
              art: 'schools',
            },
            {
              title: t('marketing.integrationsPage.forms'),
              text: t('marketing.integrationsPage.formsText'),
              art: 'assignments',
            },
            {
              title: t('marketing.integrationsPage.slides'),
              text: t('marketing.integrationsPage.slidesText'),
              art: 'presentations',
            },
            {
              title: t('marketing.integrationsPage.canva'),
              text: t('marketing.integrationsPage.canvaText'),
              art: 'presentations',
            },
            {
              title: t('marketing.integrationsPage.microsoft'),
              text: t('marketing.integrationsPage.microsoftText'),
              art: 'presentations',
            },
            {
              title: t('marketing.integrationsPage.stripe'),
              text: t('marketing.integrationsPage.stripeText'),
              art: 'shield',
            },
            {
              title: t('marketing.integrationsPage.email'),
              text: t('marketing.integrationsPage.emailText'),
              art: 'families',
            },
          ]}
        />
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
