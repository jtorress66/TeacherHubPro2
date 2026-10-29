import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { planBadge } from '../../../server/plan-display.ts';
import { requireUser } from '../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('nav.dashboard') };
}

export default async function DashboardPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school, subscription, access } = await requireUser(locale);

  return (
    <section className="stack">
      <h1>{t('dashboard.welcome', { name: user.name })}</h1>
      <p className="muted">{school.name}</p>
      <p>
        <span className="badge" data-testid="plan-badge">
          {planBadge(subscription, access, locale)}
        </span>{' '}
        {subscription?.status === 'trialing' ? (
          <Link href={`/${locale}/app/billing`}>{t('dashboard.seePlans')}</Link>
        ) : null}
      </p>
    </section>
  );
}
