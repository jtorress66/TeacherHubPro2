import Link from 'next/link';
import type { ReactNode } from 'react';
import { hasConfirmedEmail, isAdminOf } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { AppNav, type NavGroup } from '../../../components/app-nav.tsx';
import { TimeZoneCookie } from '../../../components/browser-helpers.tsx';
import { ConfirmEmailBanner } from '../../../components/confirm-email-forms.tsx';
import { Logo } from '../../../components/logo.tsx';
import { getAppContainer } from '../../../container.ts';
import { requireUser } from '../../_lib/auth.ts';
import { teacherTimeZone } from '../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export const dynamic = 'force-dynamic';

export default async function AppLayout(props: LocaleParams & { readonly children: ReactNode }) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const readyPrep = await app.countReadyPrepBatches.execute({ actor: user });
  const canInvite = await app.getInvitePage.isOpenTo(user);
  const managesSchool = await app.getSchoolOverview.isOpenTo(user);
  const deletion = await app.getSchoolDeletion.execute({ actor: user });
  const deletionDate =
    deletion === null
      ? null
      : new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeZone: await teacherTimeZone(),
        }).format(deletion.deleteAfter);
  const managesDeletion = deletion !== null && (await app.requestSchoolDeletion.isOpenTo(user));
  const base = `/${locale}/app`;
  const groups: NavGroup[] = [
    {
      title: t('nav.groupPlan'),
      links: [
        { href: base, label: t('nav.dashboard'), icon: 'dashboard' },
        { href: `${base}/plans`, label: t('nav.lessonPlans'), icon: 'plans' },
        { href: `${base}/assistant`, label: t('nav.assistant'), icon: 'assistant' },
        { href: `${base}/presentations`, label: t('nav.presentations'), icon: 'presentations' },
        { href: `${base}/rubrics`, label: t('nav.rubrics'), icon: 'rubrics' },
        { href: `${base}/prep`, label: t('nav.prep'), icon: 'prep', badge: readyPrep },
      ],
    },
    {
      title: t('nav.groupTeach'),
      links: [
        { href: `${base}/classes`, label: t('nav.classes'), icon: 'classes' },
        { href: `${base}/attendance`, label: t('nav.attendance'), icon: 'attendance' },
        { href: `${base}/gradebook`, label: t('nav.gradebook'), icon: 'gradebook' },
        { href: `${base}/games`, label: t('nav.games'), icon: 'games' },
        { href: `${base}/live`, label: t('nav.live'), icon: 'live' },
        { href: `${base}/learning`, label: t('nav.learning'), icon: 'learning' },
        { href: `${base}/approvals`, label: t('nav.approvals'), icon: 'approvals' },
      ],
    },
    {
      title: t('nav.groupAccount'),
      links: [
        { href: `${base}/semesters`, label: t('nav.semesters'), icon: 'semesters' },
        { href: `${base}/billing`, label: t('nav.billing'), icon: 'billing' },
        ...(canInvite
          ? [{ href: `${base}/invite`, label: t('nav.invite'), icon: 'invite' as const }]
          : []),
        ...(managesSchool
          ? [
              {
                href: `${base}/school`,
                label: t('nav.schoolOverview'),
                icon: 'schoolOverview' as const,
              },
            ]
          : []),
        { href: `${base}/integrations`, label: t('nav.connectedTools'), icon: 'connectedTools' },
        { href: `${base}/settings`, label: t('nav.settings'), icon: 'settings' },
      ],
    },
  ];
  const adminLinks: NavGroup['links'] = [
    ...(isAdminOf(user, user.schoolId)
      ? [{ href: `${base}/admin`, label: t('nav.schoolUsers'), icon: 'admin' as const }]
      : []),
    ...(user.role === 'super_admin'
      ? [{ href: `${base}/super-admin`, label: t('nav.superAdmin'), icon: 'superAdmin' as const }]
      : []),
  ];
  if (adminLinks.length > 0) groups.push({ title: t('nav.groupAdmin'), links: adminLinks });

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
      <main className="app-main">
        {deletionDate === null ? null : (
          <section className="alert deletion-banner no-print" role="status">
            <p>{t('schoolDeletion.notice', { date: deletionDate })}</p>
            {managesDeletion ? (
              <Link href={`${base}/settings#delete-heading`} className="button secondary">
                {t('schoolDeletion.manage')}
              </Link>
            ) : null}
          </section>
        )}
        {hasConfirmedEmail(user) ? null : <ConfirmEmailBanner locale={locale} email={user.email} />}
        {props.children}
      </main>
      <TimeZoneCookie />
    </div>
  );
}
