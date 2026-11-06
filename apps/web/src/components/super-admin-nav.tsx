import Link from 'next/link';
import { createTranslator, type Locale } from '@thp/i18n';

/** The super admin pages' tabs. */
export function SuperAdminNav({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const base = `/${locale}/app/super-admin`;
  return (
    <nav aria-label={t('superAdmin.title')} className="button-row">
      <Link href={base}>{t('superAdmin.overview')}</Link>
      <Link href={`${base}/schools`}>{t('superAdmin.schools')}</Link>
      <Link href={`${base}/users`}>{t('superAdmin.users')}</Link>
      <Link href={`${base}/import`}>{t('superAdmin.import')}</Link>
      <Link href={`${base}/leads`}>{t('marketing.leads.title')}</Link>
    </nav>
  );
}
