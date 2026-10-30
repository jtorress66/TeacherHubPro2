import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { letterGrades, type ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../../components/browser-helpers.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import {
  formatGpa,
  formatPercent,
  formatPoints,
  letterBand,
} from '../../../../../../../server/gradebook-display.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; classId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function GradebookReportPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getGradebookReport.execute({
    actor: user,
    classId: classId as ClassId,
  });
  if (!found.ok) notFound();
  const { cls, average, gpa, letter, distribution, assignments, rows } = found.value;

  return (
    <section className="stack report">
      <p className="no-print">
        <Link href={`/${locale}/app/classes/${cls.id}/gradebook`}>← {t('gradebook.back')}</Link>
      </p>
      <h1>
        {t('gradebook.report')}: {cls.name}
      </h1>
      <p className="no-print">
        <PrintButton locale={locale} />
      </p>
      <dl className="stats">
        <div>
          <dt>{t('gradebook.classAverage')}</dt>
          <dd data-testid="class-average">
            {formatPercent(average, locale)}
            {letter ? ` (${letter})` : ''}
          </dd>
        </div>
        <div>
          <dt>{t('gradebook.classGpa')}</dt>
          <dd data-testid="class-gpa">{formatGpa(gpa, locale)}</dd>
        </div>
        <div>
          <dt>{t('gradebook.students')}</dt>
          <dd>{rows.length}</dd>
        </div>
        <div>
          <dt>{t('gradebook.assignmentsCount')}</dt>
          <dd>{assignments}</dd>
        </div>
      </dl>

      <section aria-labelledby="distribution-heading">
        <h2 id="distribution-heading">{t('gradebook.distribution')}</h2>
        <ul className="distribution" data-testid="distribution">
          {letterGrades.map((grade) => (
            <li key={grade} className={`letter letter-${letterBand(grade)}`}>
              {t('gradebook.lettersCount', { letter: grade, count: distribution[grade] })}
            </li>
          ))}
        </ul>
      </section>

      <table className="roster">
        <thead>
          <tr>
            <th scope="col">{t('gradebook.student')}</th>
            <th scope="col">{t('gradebook.completed')}</th>
            <th scope="col">{t('gradebook.pointsEarned')}</th>
            <th scope="col">{t('gradebook.overall')}</th>
            <th scope="col">{t('gradebook.gpa')}</th>
            <th scope="col">{t('gradebook.letter')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, summary }) => (
            <tr key={student.id} data-testid="report-row">
              <th scope="row">
                {student.lastName}, {student.firstName}
              </th>
              <td>{summary.completed}</td>
              <td>
                {formatPoints(summary.earned, locale)} / {formatPoints(summary.possible, locale)}
              </td>
              <td>{formatPercent(summary.overall, locale)}</td>
              <td>{formatGpa(summary.gpa, locale)}</td>
              <td>
                <span className={`letter letter-${letterBand(summary.letter)}`}>
                  {summary.letter ?? '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{t('gradebook.reportNote')}</p>
    </section>
  );
}
