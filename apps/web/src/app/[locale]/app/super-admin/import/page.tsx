import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { ImportStudentsForm, ImportTeachersForm } from '../../../../../components/admin-forms.tsx';
import { SuperAdminNav } from '../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Bulk imports: a school's teachers, and students into any school's class. */
export default async function ImportPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const schools = await app.listSchools.execute({ actor: user });
  if (!schools.ok) notFound();
  const classes = (
    await Promise.all(
      schools.value.map(async ({ school }) => {
        const list = await app.listSchoolClasses.execute({ actor: user, schoolId: school.id });
        return list.ok
          ? list.value
              .filter((cls) => cls.archivedAt === null)
              .map((cls) => ({
                id: `${school.id}/${cls.id}`,
                name: `${school.name} · ${cls.name}`,
              }))
          : [];
      }),
    )
  ).flat();
  const sample = (kind: string) => `/samples/${kind}-${locale === 'es' ? 'es' : 'en'}.csv`;

  return (
    <section className="stack">
      <h1>{t('superAdmin.import')}</h1>
      <SuperAdminNav locale={locale} />
      <section className="card stack" aria-labelledby="import-teachers-heading">
        <h2 id="import-teachers-heading">{t('superAdmin.importTeachers')}</h2>
        <p className="hint">{t('superAdmin.importTeachersIntro')}</p>
        <p>
          <a href={sample('teachers')} download>
            {t('superAdmin.sample')}
          </a>
        </p>
        <ImportTeachersForm
          locale={locale}
          schools={schools.value.map(({ school }) => ({ id: school.id, name: school.name }))}
        />
      </section>
      <section className="card stack" aria-labelledby="import-students-heading">
        <h2 id="import-students-heading">{t('superAdmin.importStudents')}</h2>
        <p className="hint">{t('superAdmin.importStudentsIntro')}</p>
        <p>
          <a href={sample('students')} download>
            {t('superAdmin.sample')}
          </a>
        </p>
        <ImportStudentsForm locale={locale} classes={classes} />
      </section>
    </section>
  );
}
