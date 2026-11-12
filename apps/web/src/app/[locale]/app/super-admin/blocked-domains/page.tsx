import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { BlockDomainForm, UnblockDomainForm } from '../../../../../components/protection-forms.tsx';
import { SuperAdminNav } from '../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Email domains that may not sign up; blocking one suspends the accounts already there. */
export default async function BlockedDomainsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const blocked = await getAppContainer().listBlockedDomains.execute({ actor: user });
  if (!blocked.ok) notFound();

  return (
    <section className="stack">
      <h1>{t('superAdmin.blockedDomains')}</h1>
      <SuperAdminNav locale={locale} />
      <p className="muted">{t('superAdmin.blockedDomainsIntro')}</p>
      <section className="card stack">
        <BlockDomainForm locale={locale} />
      </section>
      {blocked.value.length === 0 ? (
        <p className="muted">{t('superAdmin.noBlockedDomains')}</p>
      ) : (
        <ul className="list" aria-label={t('superAdmin.blockedDomains')}>
          {blocked.value.map(({ domain }) => (
            <li key={domain}>
              <strong>{domain}</strong>
              <UnblockDomainForm locale={locale} domain={domain} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
