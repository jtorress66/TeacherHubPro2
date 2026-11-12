import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { AuthShell } from '../../../components/auth-shell.tsx';
import { ForgotPasswordForm } from '../../../components/password-forms.tsx';
import { notListed } from '../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return {
    title: createTranslator(await localeFrom(props))('passwords.forgotTitle'),
    robots: notListed,
  };
}

/** Asks for a reset link; the answer never says whether the email has an account. */
export default async function ForgotPasswordPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <AuthShell
      locale={locale}
      title={t('passwords.forgotTitle')}
      footer={<Link href={`/${locale}/login`}>{t('auth.logIn')}</Link>}
    >
      <p>{t('passwords.forgotIntro')}</p>
      <ForgotPasswordForm locale={locale} />
    </AuthShell>
  );
}
