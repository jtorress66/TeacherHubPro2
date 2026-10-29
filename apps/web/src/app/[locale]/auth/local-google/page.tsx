import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Test Google account — TeacherHubPro' };

/** Stand-in for Google's account picker, available only with GOOGLE_AUTH_PROVIDER=local. */
export default async function LocalGooglePage(
  props: LocaleParams & {
    readonly searchParams: Promise<{ state?: string; redirect_uri?: string }>;
  },
) {
  const locale = await localeFrom(props);
  if (!getAppContainer().issueLocalGoogleCode) notFound();
  const t = createTranslator(locale);
  const { state = '', redirect_uri: redirectUri = '' } = await props.searchParams;

  return (
    <main className="auth">
      <section className="card stack">
        <p className="test-banner">{t('localGoogle.intro')}</p>
        <h1>{t('localGoogle.title')}</h1>
        {/* A plain form: the browser navigates for real, so the session cookie is set on return. */}
        <form method="post" action="/api/auth/google/local" className="stack">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <div className="field">
            <label htmlFor="email">{t('localGoogle.email')}</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="name">{t('localGoogle.name')}</label>
            <input id="name" name="name" />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="verified" defaultChecked /> {t('localGoogle.verified')}
          </label>
          <button type="submit" className="button">
            {t('localGoogle.continue')}
          </button>
        </form>
      </section>
    </main>
  );
}
