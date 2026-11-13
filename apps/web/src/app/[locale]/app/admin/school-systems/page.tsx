import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { CopyValue, LtiPlatformForm } from '../../../../../components/lti-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { ltiToolValues } from '../../../../../server/lti.ts';
import { removeLtiPlatformAction } from '../../../../_lib/lti-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('lti.title') };
}

/**
 * A school admin connects the school's course system (LTI 1.3): the values IT pastes into it,
 * the details it gives back, and the systems already set up. Only while LTI is on.
 */
export default async function SchoolSystemsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  if (app.lti === null) notFound();
  const platforms = await app.lti.list.execute({ actor: user });
  if (!platforms.ok) notFound();
  const values = ltiToolValues(app.appUrl);
  const copyable = [
    { id: 'lti-login-url', label: t('lti.loginUrl'), value: values.loginUrl },
    { id: 'lti-launch-url', label: t('lti.launchUrl'), value: values.launchUrl },
    { id: 'lti-jwks-url', label: t('lti.jwksUrl'), value: values.jwksUrl },
    { id: 'lti-domain', label: t('lti.domain'), value: values.domain },
  ];

  return (
    <section className="stack">
      <h1>{t('lti.title')}</h1>
      <p>{t('lti.intro')}</p>
      <section className="card stack" aria-labelledby="lti-values-heading">
        <h2 id="lti-values-heading">{t('lti.toolValues')}</h2>
        <p className="hint">{t('lti.toolValuesHint')}</p>
        {copyable.map((item) => (
          <CopyValue key={item.id} locale={locale} {...item} />
        ))}
      </section>
      <section className="card stack" aria-labelledby="lti-registered-heading">
        <h2 id="lti-registered-heading">{t('lti.registered')}</h2>
        {platforms.value.length === 0 ? <p>{t('lti.none')}</p> : null}
        <ul className="stack">
          {platforms.value.map((platform) => (
            <li key={platform.id} className="stack">
              <strong>{platform.name}</strong>
              <span className="muted small">
                {platform.issuer} · {platform.clientId}
              </span>
              <span className="muted small">
                {t('lti.deployments', { ids: platform.deploymentIds.join(', ') })}
              </span>
              <form action={removeLtiPlatformAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="platformId" value={platform.id} />
                <button
                  type="submit"
                  className="button secondary"
                  aria-label={t('lti.removeNamed', { name: platform.name })}
                >
                  {t('lti.remove')}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {platforms.value.length === 0 ? null : <p className="hint">{t('lti.removeHint')}</p>}
      </section>
      <section className="card stack" aria-labelledby="lti-add-heading">
        <h2 id="lti-add-heading">{t('lti.addTitle')}</h2>
        <LtiPlatformForm locale={locale} />
      </section>
    </section>
  );
}
