import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { AuthShell } from '../../../components/auth-shell.tsx';
import { SetUpSuperAdminForm } from '../../../components/password-forms.tsx';
import { getAppContainer } from '../../../container.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('passwords.setupTitle') };
}

/** The first super admin, with the key set on the server; off when no key is set. */
export default async function SetupPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <AuthShell
      locale={locale}
      title={t('passwords.setupTitle')}
      footer={<Link href={`/${locale}/signup`}>{t('auth.createAccount')}</Link>}
    >
      {getAppContainer().superAdminSetupAvailable ? (
        <>
          <p>{t('passwords.setupIntro')}</p>
          <SetUpSuperAdminForm locale={locale} />
        </>
      ) : (
        <p role="status" className="notice">
          {t('errors.setup_unavailable')}
        </p>
      )}
    </AuthShell>
  );
}
