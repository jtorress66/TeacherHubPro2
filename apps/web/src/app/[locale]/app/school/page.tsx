import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { coverageStatuses, usageWindowDays } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { SchoolFeaturesForm } from '../../../../components/school-features-form.tsx';
import { TableScroll } from '../../../../components/table-scroll.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** For the school's admins and owner: who uses the app, how much, and the school-wide switches. */
export default async function SchoolOverviewPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const [overview, coverage] = await Promise.all([
    app.getSchoolOverview.execute({ actor: user }),
    app.getSchoolStandardsCoverage.execute({ actor: user }),
  ]);
  if (!overview.ok || !coverage.ok) notFound();
  const { teachers, totals, features } = overview.value;
  const day = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: await teacherTimeZone(),
  });

  return (
    <section className="stack">
      <h1>{t('schoolOverview.title')}</h1>
      <p>{t('schoolOverview.intro', { school: school.name, days: usageWindowDays })}</p>

      <dl className="stats" aria-label={t('schoolOverview.title')}>
        <div>
          <dt>{t('schoolOverview.activeTeachers')}</dt>
          <dd>
            {t('schoolOverview.activeOf', {
              active: totals.activeTeachers,
              total: totals.teachers,
            })}
          </dd>
        </div>
        <div>
          <dt>{t('schoolOverview.students')}</dt>
          <dd>{totals.students}</dd>
        </div>
        <div>
          <dt>{t('schoolOverview.aiDrafts')}</dt>
          <dd>{totals.aiDrafts}</dd>
        </div>
        <div>
          <dt>{t('schoolOverview.attendanceDays')}</dt>
          <dd>{totals.attendanceDays}</dd>
        </div>
      </dl>

      <section className="stack" aria-labelledby="by-teacher-heading">
        <h2 id="by-teacher-heading">{t('schoolOverview.byTeacher')}</h2>
        <TableScroll>
          <table className="roster" aria-label={t('schoolOverview.byTeacher')}>
            <thead>
              <tr>
                <th scope="col">{t('schoolOverview.col_name')}</th>
                <th scope="col">{t('schoolOverview.col_lastActive')}</th>
                <th scope="col">{t('schoolOverview.col_classes')}</th>
                <th scope="col">{t('schoolOverview.col_students')}</th>
                <th scope="col">{t('schoolOverview.col_aiDrafts')}</th>
                <th scope="col">{t('schoolOverview.col_attendance')}</th>
                <th scope="col">{t('schoolOverview.col_assignments')}</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((row) => (
                <tr key={row.teacherId} data-testid="usage-row">
                  <th scope="row">{row.name}</th>
                  <td>
                    {row.lastActiveAt === null
                      ? t('schoolOverview.never')
                      : day.format(row.lastActiveAt)}
                  </td>
                  <td>{row.classes}</td>
                  <td>{row.students}</td>
                  <td>{row.aiDrafts}</td>
                  <td>{row.attendanceDays}</td>
                  <td>{row.assignments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </section>

      <section className="card stack" aria-labelledby="coverage-heading">
        <h2 id="coverage-heading">{t('standards.coverageSchoolTitle')}</h2>
        <p className="hint">{t('standards.coverageSchoolHint')}</p>
        {coverage.value.classes.length === 0 ? (
          <p className="muted">{t('standards.coverageSchoolNone')}</p>
        ) : (
          <TableScroll>
            <table className="roster" aria-label={t('standards.coverageSchoolTitle')}>
              <thead>
                <tr>
                  <th scope="col">{t('standards.coverageClass')}</th>
                  {coverageStatuses.map((status) => (
                    <th scope="col" key={status}>
                      {t(`standards.coverage_${status}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.value.classes.map((row) => (
                  <tr key={row.classId}>
                    <th scope="row">
                      <a href={`/${locale}/app/classes/${row.classId}/standards`}>{row.name}</a>
                    </th>
                    {coverageStatuses.map((status) => (
                      <td key={status}>{row.summary[status]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      <section className="card stack" aria-labelledby="curriculum-heading">
        <h2 id="curriculum-heading">{t('curriculum.title')}</h2>
        <p className="hint">{t('curriculum.linkHint')}</p>
        <p>
          <a className="button secondary" href={`/${locale}/app/curriculum`}>
            {t('curriculum.link')}
          </a>
        </p>
      </section>

      <section className="card stack" aria-labelledby="switches-heading">
        <h2 id="switches-heading">{t('schoolOverview.switchesTitle')}</h2>
        <p className="hint">{t('schoolOverview.switchesIntro')}</p>
        <SchoolFeaturesForm locale={locale} features={features} />
      </section>
    </section>
  );
}
