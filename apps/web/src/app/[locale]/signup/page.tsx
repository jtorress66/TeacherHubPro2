import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { AuthShell } from '../../../components/auth-shell.tsx';
import { SignUpForm } from '../../../components/forms.tsx';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('auth.signUpTitle') };
}

export default async function SignUpPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <AuthShell
      locale={locale}
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')} <Link href={`/${locale}/login`}>{t('auth.logIn')}</Link>
        </>
      }
    >
      <SignUpForm locale={locale} />
    </AuthShell>
  );
}
