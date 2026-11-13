import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { PageIntro, TrialCta } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { ToolCard, ToolFilter, ToolRequest, ToolText } from '../../../../components/tool-card.tsx';
import {
  comingSoon,
  toolGroupFrom,
  toolsIn,
  type ToolId,
} from '../../../../server/connected-tools.ts';
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

/** Teams needs the school's IT to approve it, so it is turned on for schools that ask. */
const onRequest: ReadonlySet<ToolId> = new Set<ToolId>(['teams']);

/** The services the app works with today, plus the school systems that are coming. */
export default async function IntegrationsPage(
  props: LocaleParams & { readonly searchParams: Promise<{ group?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const group = toolGroupFrom((await props.searchParams).group);
  return (
    <MarketingShell locale={locale} path="/integrations">
      <PageIntro
        title={t('marketing.integrationsPage.title')}
        intro={t('marketing.integrationsPage.intro')}
      />
      <section className="m-section stack">
        <ToolFilter locale={locale} path={`/${locale}/integrations`} current={group} />
        <div className="settings-grid">
          {toolsIn(group).map((tool) => (
            <ToolCard
              key={tool.id}
              locale={locale}
              headingId={`${tool.id}-heading`}
              heading={t(`connectedTools.tool.${tool.id}.name`)}
              group={tool.group}
            >
              <ToolText locale={locale} id={tool.id} />
              {comingSoon.has(tool.id) || onRequest.has(tool.id) ? (
                <ToolRequest
                  locale={locale}
                  id={tool.id}
                  status={comingSoon.has(tool.id) ? 'comingSoon' : 'onRequest'}
                />
              ) : null}
            </ToolCard>
          ))}
        </div>
      </section>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
