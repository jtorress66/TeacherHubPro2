import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { AuthShell } from '../../../components/auth-shell.tsx';
import { SetPasswordForm } from '../../../components/password-forms.tsx';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('passwords.setTitle') };
}

/** Where emailed set-password links land; the secret stays in the link's #hash. */
export default async function SetPasswordPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <AuthShell
      locale={locale}
      title={t('passwords.setTitle')}
      footer={<Link href={`/${locale}/login`}>{t('auth.logIn')}</Link>}
    >
      <SetPasswordForm locale={locale} />
    </AuthShell>
  );
}
