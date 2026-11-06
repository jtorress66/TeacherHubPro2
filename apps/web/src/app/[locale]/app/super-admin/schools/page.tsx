import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { SchoolDetailsForm } from '../../../../../components/admin-forms.tsx';
import { SuperAdminNav } from '../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Every school with its counts, and a form for a new one. */
export default async function SchoolsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const schools = await getAppContainer().listSchools.execute({ actor: user });
  if (!schools.ok) notFound();
  const base = `/${locale}/app/super-admin/schools`;

  return (
    <section className="stack">
      <h1>{t('superAdmin.schools')}</h1>
      <SuperAdminNav locale={locale} />
      <ul className="list" aria-label={t('superAdmin.schools')}>
        {schools.value.map(({ school, counts }) => (
          <li key={school.id}>
            <Link href={`${base}/${school.id}`}>{school.name}</Link>{' '}
            <span className="hint">
              {t('superAdmin.schoolCounts', {
                users: counts.users,
                classes: counts.classes,
                students: counts.students,
              })}
            </span>
          </li>
        ))}
      </ul>
      <section className="card stack" aria-labelledby="new-school-heading">
        <h2 id="new-school-heading">{t('superAdmin.newSchool')}</h2>
        <SchoolDetailsForm locale={locale} />
      </section>
    </section>
  );
}
