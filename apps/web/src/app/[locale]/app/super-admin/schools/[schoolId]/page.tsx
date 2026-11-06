import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { SchoolId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  DeleteForm,
  NewUserForm,
  SchoolDetailsForm,
  TransferForm,
} from '../../../../../../components/admin-forms.tsx';
import { SuperAdminNav } from '../../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; schoolId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One school: its details, classes and users, a new user, handing classes over, and delete. */
export default async function SchoolPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { schoolId } = await props.params;
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const id = schoolId as SchoolId;
  const [schools, classes, users] = await Promise.all([
    app.listSchools.execute({ actor: user }),
    app.listSchoolClasses.execute({ actor: user, schoolId: id }),
    app.listSchoolUsers.execute({ actor: user, schoolId: id }),
  ]);
  if (!schools.ok || !classes.ok || !users.ok) notFound();
  const school = schools.value.find((row) => row.school.id === id)?.school;
  if (school === undefined) notFound();
  const names = new Map(users.value.map(({ user: person }) => [person.id, person.name]));
  const base = `/${locale}/app/super-admin/schools/${school.id}`;

  return (
    <section className="stack">
      <h1>{school.name}</h1>
      <SuperAdminNav locale={locale} />
      <section className="card stack" aria-labelledby="school-details-heading">
        <h2 id="school-details-heading">{t('superAdmin.saveSchool')}</h2>
        <SchoolDetailsForm locale={locale} school={school} />
      </section>
      <section className="card stack" aria-labelledby="school-users-heading">
        <h2 id="school-users-heading">{t('superAdmin.schoolUsers')}</h2>
        <ul className="list" aria-label={t('superAdmin.schoolUsers')}>
          {users.value.map(({ user: person, classes: count }) => (
            <li key={person.id}>
              <Link href={`${base}/users/${person.id}`}>{person.name}</Link>{' '}
              <span className="hint">
                {person.email} · {t(`admin.role_${person.role}`)} · {t('admin.classes')}: {count}
              </span>
            </li>
          ))}
        </ul>
        <h3>{t('superAdmin.newUser')}</h3>
        <NewUserForm locale={locale} schoolId={school.id} />
      </section>
      <section className="card stack" aria-labelledby="school-classes-heading">
        <h2 id="school-classes-heading">{t('superAdmin.schoolClasses')}</h2>
        {classes.value.length === 0 ? (
          <p className="muted">{t('superAdmin.noClasses')}</p>
        ) : (
          <ul className="list" aria-label={t('superAdmin.schoolClasses')}>
            {classes.value.map((cls) => (
              <li key={cls.id}>
                {cls.name} <span className="hint">{names.get(cls.teacherId) ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card stack" aria-labelledby="school-transfer-heading">
        <h2 id="school-transfer-heading">{t('admin.transfer')}</h2>
        <p className="hint">{t('admin.transferIntro')}</p>
        <TransferForm
          locale={locale}
          schoolId={school.id}
          teachers={users.value.map(({ user: person }) => ({ id: person.id, name: person.name }))}
        />
      </section>
      <DeleteForm locale={locale} kind="school" schoolId={school.id} />
    </section>
  );
}
