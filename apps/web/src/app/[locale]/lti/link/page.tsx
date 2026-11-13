import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { AuthShell } from '../../../../components/auth-shell.tsx';
import { LogInForm } from '../../../../components/forms.tsx';
import { LinkLtiAccountForm } from '../../../../components/lti-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { LTI_LINK_COOKIE, ltiProblemFor } from '../../../../server/lti.ts';
import { notListed } from '../../../../server/marketing-pages.ts';
import { cancelLtiLinkAction, logOutForLtiLinkAction } from '../../../_lib/lti-actions.ts';
import { currentUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return {
    title: createTranslator(await localeFrom(props))('lti.linkTitle'),
    robots: notListed,
  };
}

/**
 * A teacher's first launch from a course system: they log in once with their existing account
 * (logging in comes back here), then confirm the link. The waiting launch is kept in a
 * short-lived cookie, never in the address.
 */
export default async function LtiLinkPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const lti = getAppContainer().lti;
  if (lti === null) notFound();
  const ticket = (await cookies()).get(LTI_LINK_COOKIE)?.value ?? '';
  const described = await lti.describeLink.execute({ ticket });
  if (!described.ok) {
    redirect(`/${locale}/lti/problem?reason=${ltiProblemFor(described.error.code)}`);
  }
  const intro = t('lti.linkIntro', { platform: described.value.platformName });
  const auth = await currentUser();

  if (auth === null) {
    return (
      <AuthShell
        locale={locale}
        title={t('lti.linkTitle')}
        subtitle={`${intro} ${t('lti.linkLogInFirst')}`}
        footer={t('lti.linkNoAccount')}
      >
        <LogInForm locale={locale} />
      </AuthShell>
    );
  }
  return (
    <main className="student-page stack">
      <section className="card stack">
        <h1>{t('lti.linkTitle')}</h1>
        <p>{intro}</p>
        <p>{t('lti.linkSignedInAs', { name: auth.user.name, email: auth.user.email })}</p>
        <LinkLtiAccountForm locale={locale} />
        <form action={cancelLtiLinkAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="button secondary">
            {t('lti.linkCancel')}
          </button>
        </form>
        <p className="hint">{t('lti.linkNotYou')}</p>
        <form action={logOutForLtiLinkAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="button secondary">
            {t('nav.logOut')}
          </button>
        </form>
      </section>
    </main>
  );
}
