import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator, type MessageKey } from '@thp/i18n';
import { AuthShell } from '../../../components/auth-shell.tsx';
import { LogInForm } from '../../../components/forms.tsx';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('auth.logInTitle') };
}

/** Messages a redirect can ask the login page to show. */
const notices: Readonly<Record<string, MessageKey>> = {
  google_failed: 'errors.google_failed',
  google_email_unverified: 'errors.google_email_unverified',
};

export default async function LogInPage(
  props: LocaleParams & { readonly searchParams: Promise<{ expired?: string; error?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { expired, error } = await props.searchParams;
  const noticeKey =
    expired === '1' ? 'auth.sessionExpired' : error === undefined ? undefined : notices[error];
  return (
    <AuthShell
      locale={locale}
      title={t('auth.logInTitle')}
      notice={noticeKey === undefined ? undefined : t(noticeKey)}
      footer={
        <>
          {t('auth.noAccount')} <Link href={`/${locale}/signup`}>{t('auth.createAccount')}</Link>
        </>
      }
    >
      <LogInForm locale={locale} />
    </AuthShell>
  );
}
