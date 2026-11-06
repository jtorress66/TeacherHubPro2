import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { SuperAdminNav } from '../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The super admin overview: platform numbers, the newest users and every school. */
export default async function SuperAdminPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const overview = await getAppContainer().getPlatformOverview.execute({ actor: user });
  if (!overview.ok) notFound();
  const { counts, recentUsers, schools } = overview.value;
  const base = `/${locale}/app/super-admin`;
  const stats = [
    ['stat_schools', counts.schools],
    ['stat_teachers', counts.users.teacher],
    ['stat_admins', counts.users.school_admin + counts.users.super_admin],
    ['stat_classes', counts.classes],
    ['stat_students', counts.students],
    ['stat_plans', counts.lessonPlans],
  ] as const;

  return (
    <section className="stack">
      <h1>{t('superAdmin.title')}</h1>
      <SuperAdminNav locale={locale} />
      <dl className="stats" aria-label={t('superAdmin.overview')}>
        {stats.map(([key, value]) => (
          <div key={key}>
            <dt>{t(`superAdmin.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="card stack" aria-labelledby="recent-heading">
        <h2 id="recent-heading">{t('superAdmin.recentUsers')}</h2>
        <ul className="list">
          {recentUsers.map((person) => (
            <li key={person.id}>
              <Link href={`${base}/schools/${person.schoolId}/users/${person.id}`}>
                {person.name}
              </Link>{' '}
              <span className="hint">
                {person.email} · {t(`admin.role_${person.role}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack" aria-labelledby="schools-heading">
        <h2 id="schools-heading">{t('superAdmin.schools')}</h2>
        <ul className="list">
          {schools.map(({ school, counts: c }) => (
            <li key={school.id}>
              <Link href={`${base}/schools/${school.id}`}>{school.name}</Link>{' '}
              <span className="hint">
                {t('superAdmin.schoolCounts', {
                  users: c.users,
                  classes: c.classes,
                  students: c.students,
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
