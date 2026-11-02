import Link from 'next/link';
import type { ReactNode } from 'react';
import { createTranslator } from '@thp/i18n';
import { AppNav, type NavGroup } from '../../../components/app-nav.tsx';
import { TimeZoneCookie } from '../../../components/browser-helpers.tsx';
import { Logo } from '../../../components/logo.tsx';
import { requireUser } from '../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export const dynamic = 'force-dynamic';

export default async function AppLayout(props: LocaleParams & { readonly children: ReactNode }) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { school } = await requireUser(locale, { needsAccess: false });
  const base = `/${locale}/app`;
  const groups: NavGroup[] = [
    {
      title: t('nav.groupPlan'),
      links: [
        { href: base, label: t('nav.dashboard'), icon: 'dashboard' },
        { href: `${base}/plans`, label: t('nav.lessonPlans'), icon: 'plans' },
        { href: `${base}/assistant`, label: t('nav.assistant'), icon: 'assistant' },
        { href: `${base}/presentations`, label: t('nav.presentations'), icon: 'presentations' },
      ],
    },
    {
      title: t('nav.groupTeach'),
      links: [
        { href: `${base}/classes`, label: t('nav.classes'), icon: 'classes' },
        { href: `${base}/attendance`, label: t('nav.attendance'), icon: 'attendance' },
        { href: `${base}/gradebook`, label: t('nav.gradebook'), icon: 'gradebook' },
        { href: `${base}/games`, label: t('nav.games'), icon: 'games' },
      ],
    },
    {
      title: t('nav.groupAccount'),
      links: [
        { href: `${base}/semesters`, label: t('nav.semesters'), icon: 'semesters' },
        { href: `${base}/billing`, label: t('nav.billing'), icon: 'billing' },
        { href: `${base}/settings`, label: t('nav.settings'), icon: 'settings' },
      ],
    },
  ];

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="sidebar-top">
          <Link href={base} className="brand">
            <Logo />
          </Link>
          <p className="school-name" data-testid="school-name">
            {school.name}
          </p>
        </div>
        <AppNav
          locale={locale}
          label={t('app.name')}
          menuLabel={t('nav.menu')}
          logOutLabel={t('nav.logOut')}
          groups={groups}
        />
      </aside>
      <main className="app-main">{props.children}</main>
      <TimeZoneCookie />
    </div>
  );
}
