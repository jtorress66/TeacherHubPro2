import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { AuthShell } from '../../../components/auth-shell.tsx';
import { ConfirmEmailForm } from '../../../components/confirm-email-forms.tsx';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('confirmEmail.title') };
}

/** Where emailed "confirm your email" links land; the secret stays in the link's #hash. */
export default async function ConfirmEmailPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <AuthShell
      locale={locale}
      title={t('confirmEmail.title')}
      footer={<Link href={`/${locale}/login`}>{t('auth.logIn')}</Link>}
    >
      <ConfirmEmailForm locale={locale} />
    </AuthShell>
  );
}
