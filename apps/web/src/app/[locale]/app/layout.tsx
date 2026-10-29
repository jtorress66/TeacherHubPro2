import Link from 'next/link';
import type { ReactNode } from 'react';
import { createTranslator } from '@thp/i18n';
import { logOutAction } from '../../_lib/actions.ts';
import { requireUser } from '../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export const dynamic = 'force-dynamic';

export default async function AppLayout(props: LocaleParams & { readonly children: ReactNode }) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { school } = await requireUser(locale, { needsAccess: false });

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <Link href={`/${locale}/app`} className="brand">
            {t('app.name')}
          </Link>
          <span className="school-name" data-testid="school-name">
            {school.name}
          </span>
        </div>
        <nav aria-label={t('app.name')}>
          <Link href={`/${locale}/app`}>{t('nav.dashboard')}</Link>
          <Link href={`/${locale}/app/classes`}>{t('nav.classes')}</Link>
          <Link href={`/${locale}/app/semesters`}>{t('nav.semesters')}</Link>
          <Link href={`/${locale}/app/billing`}>{t('nav.billing')}</Link>
          <Link href={`/${locale}/app/settings`}>{t('nav.settings')}</Link>
          <form action={logOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="link-button">
              {t('nav.logOut')}
            </button>
          </form>
        </nav>
      </header>
      <main className="app-main">{props.children}</main>
    </div>
  );
}
