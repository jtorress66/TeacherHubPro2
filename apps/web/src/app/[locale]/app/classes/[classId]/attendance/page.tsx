import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseLocalDate, type ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { AttendanceSheetForm } from '../../../../../../components/attendance-sheet.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { reopenAttendanceAction } from '../../../../../_lib/attendance-actions.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string }>;
  readonly searchParams: Promise<{ date?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function TakeAttendancePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const requested = parseLocalDate('date', (await props.searchParams).date ?? '');
  const date = requested.ok ? requested.value : app.today(await teacherTimeZone());
  const input = { actor: user, classId: classId as ClassId };
  const [sheet, days] = await Promise.all([
    app.getAttendanceSheet.execute({ ...input, date }),
    app.listAttendanceDays.execute(input),
  ]);
  if (!sheet.ok) notFound();
  const { cls, status, editable, rows } = sheet.value;
  const classPath = `/${locale}/app/classes/${cls.id}`;
  const nameOf = (row: (typeof rows)[number]) => `${row.student.firstName} ${row.student.lastName}`;

  return (
    <section className="stack">
      <p>
        <Link href={classPath}>← {t('attendance.back')}</Link>
      </p>
      <h1>
        {t('attendance.take')}: {cls.name}
      </h1>
      <form method="get" className="field-row">
        <div className="field">
          <label htmlFor="attendance-date">{t('attendance.date')}</label>
          <input id="attendance-date" type="date" name="date" defaultValue={date} />
        </div>
        <button type="submit" className="button secondary">
          {t('attendance.show')}
        </button>
      </form>
      <p>
        <span className={`badge day-${status}`} data-testid="day-status">
          {t(`attendance.dayStatus_${status}`)}
        </span>{' '}
        <Link href={`${classPath}/attendance/report`}>{t('attendance.report')}</Link>
      </p>

      {cls.archivedAt !== null ? (
        <p role="status" className="notice">
          {t('attendance.archivedNotice')}
        </p>
      ) : null}
      {status === 'submitted' ? (
        <div className="stack">
          <p className="notice">{t('attendance.submittedNotice')}</p>
          {cls.archivedAt === null ? (
            <form action={reopenAttendanceAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="classId" value={cls.id} />
              <input type="hidden" name="date" value={date} />
              <button type="submit" className="button secondary">
                {t('attendance.reopen')}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="muted">{t('attendance.noStudents')}</p>
      ) : editable ? (
        <AttendanceSheetForm
          key={`${date}-${status}`}
          locale={locale}
          classId={cls.id}
          date={date}
          rows={rows.map((row) => ({
            id: row.student.id,
            name: nameOf(row),
            status: row.status,
            minutesLate: row.minutesLate,
            note: row.note,
          }))}
        />
      ) : (
        <table className="roster" data-testid="attendance-read-only">
          <thead>
            <tr>
              <th scope="col">{t('attendance.student')}</th>
              <th scope="col">{t('attendance.status')}</th>
              <th scope="col">{t('attendance.minutesLate')}</th>
              <th scope="col">{t('attendance.note')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.student.id}>
                <th scope="row">{nameOf(row)}</th>
                <td>{t(`attendance.status_${row.status}`)}</td>
                <td>{row.minutesLate ?? ''}</td>
                <td>{row.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="stack" aria-labelledby="recent-days">
        <h2 id="recent-days">{t('attendance.recentDays')}</h2>
        {days.ok && days.value.length > 0 ? (
          <ul className="class-list">
            {days.value.slice(0, 10).map((day) => (
              <li key={day.date}>
                <Link href={`${classPath}/attendance?date=${day.date}`}>{day.date}</Link>{' '}
                <span className="muted">{t(`attendance.dayStatus_${day.status}`)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('attendance.noDays')}</p>
        )}
      </section>
    </section>
  );
}
