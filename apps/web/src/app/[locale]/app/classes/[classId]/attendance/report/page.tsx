import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../../components/browser-helpers.tsx';
import { FormAlert } from '../../../../../../../components/forms.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { formatRate, rateBand } from '../../../../../../../server/attendance-display.ts';
import { messageFor } from '../../../../../../../server/error-messages.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string }>;
  readonly searchParams: Promise<{ from?: string; to?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function AttendanceReportPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { from, to } = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const timeZone = await teacherTimeZone();
  const input = { actor: user, classId: classId as ClassId, timeZone };
  const requested = await app.getAttendanceReport.execute({
    ...input,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const unreachable = ['not_found', 'forbidden'];
  if (!requested.ok && unreachable.includes(requested.error.code)) notFound();
  // A bad range shows its error above the last 30 days.
  const report = requested.ok ? requested : await app.getAttendanceReport.execute(input);
  if (!report.ok) notFound();
  const { cls, range, rows, days, rate } = report.value;
  const semesters = await app.listSemesters.execute({ actor: user });
  const active = semesters.find((semester) => semester.isActive);
  const reportPath = `/${locale}/app/classes/${cls.id}/attendance/report`;

  return (
    <section className="stack report">
      <p className="no-print">
        <Link href={`/${locale}/app/classes/${cls.id}/attendance`}>← {t('attendance.take')}</Link>
      </p>
      <h1>
        {t('attendance.report')}: {cls.name}
      </h1>
      <p className="muted" data-testid="report-range">
        {t('attendance.range', { from: range.from, to: range.to })} ·{' '}
        {t('attendance.daysCounted', { count: days })}
      </p>
      <nav className="actions no-print" aria-label={t('attendance.customRange')}>
        <Link href={reportPath}>{t('attendance.last30Days')}</Link>
        {active ? (
          <Link href={`${reportPath}?from=${active.startDate}&to=${active.endDate}`}>
            {t('attendance.activeSemester', { name: active.name })}
          </Link>
        ) : null}
      </nav>
      <form method="get" className="field-row no-print">
        <div className="field">
          <label htmlFor="report-from">{t('attendance.from')}</label>
          <input id="report-from" type="date" name="from" defaultValue={range.from} />
        </div>
        <div className="field">
          <label htmlFor="report-to">{t('attendance.to')}</label>
          <input id="report-to" type="date" name="to" defaultValue={range.to} />
        </div>
        <button type="submit" className="button secondary">
          {t('attendance.show')}
        </button>
        <PrintButton locale={locale} />
      </form>
      <FormAlert message={requested.ok ? undefined : messageFor(requested.error, locale)} />

      <p>
        <strong>{t('attendance.classRate')}:</strong>{' '}
        <span className={`rate band-${rateBand(rate)}`} data-testid="class-rate">
          {formatRate(rate, locale)} ({t(`attendance.band_${rateBand(rate)}`)})
        </span>
      </p>
      <table className="roster">
        <thead>
          <tr>
            <th scope="col">{t('attendance.student')}</th>
            <th scope="col">{t('attendance.present')}</th>
            <th scope="col">{t('attendance.absent')}</th>
            <th scope="col">{t('attendance.tardy')}</th>
            <th scope="col">{t('attendance.excused')}</th>
            <th scope="col">{t('attendance.total')}</th>
            <th scope="col">{t('attendance.rate')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, summary, rate: studentRate }) => {
            const band = rateBand(studentRate);
            return (
              <tr key={student.id} data-testid="report-row">
                <th scope="row">
                  {student.lastName}, {student.firstName}
                </th>
                <td>{summary.present}</td>
                <td>{summary.absent}</td>
                <td>{summary.tardy}</td>
                <td>{summary.excused}</td>
                <td>{summary.total}</td>
                <td>
                  <span className={`rate band-${band}`}>
                    {formatRate(studentRate, locale)} ({t(`attendance.band_${band}`)})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">{t('attendance.reportNote')}</p>
    </section>
  );
}
