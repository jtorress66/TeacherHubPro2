import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../components/browser-helpers.tsx';
import { getAppContainer } from '../../../../container.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; token: string }> };

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** A family's read-only view of one student, opened from their private link. */
export default async function FamilyPortalPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { token } = await props.params;
  const found = await getAppContainer().openFamilyPortal.execute({
    token,
    timeZone: await teacherTimeZone(),
  });
  if (!found.ok) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('family.notFound')}
        </p>
      </main>
    );
  }
  const { firstName, lastName, className, schoolName, report } = found.value;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const date = (value: string) => day.format(new Date(`${value}T12:00:00Z`));
  const { attendance, games } = report;

  return (
    <main className="student-page stack family-portal">
      <p className="muted small">
        {schoolName} · {className}
      </p>
      <h1>{t('family.title', { name: `${firstName} ${lastName}` })}</h1>
      <p className="notice">{t('family.readOnly')}</p>
      <p className="no-print">
        <PrintButton locale={locale} label={t('family.print')} />
      </p>

      <h2>{t('family.grades')}</h2>
      <p className="live-standing">
        {t('family.overall')}: {report.overall === null ? '—' : `${String(report.overall)}%`}
      </p>
      {report.assignments.length === 0 ? (
        <p>{t('family.noGrades')}</p>
      ) : (
        <table className="table" aria-label={t('family.grades')}>
          <thead>
            <tr>
              <th scope="col">{t('family.assignment')}</th>
              <th scope="col">{t('family.due')}</th>
              <th scope="col">{t('family.score')}</th>
            </tr>
          </thead>
          <tbody>
            {report.assignments.map((a, i) => (
              <tr key={i}>
                <td>{a.title}</td>
                <td>{a.dueDate === null ? '—' : date(a.dueDate)}</td>
                <td>
                  {a.score === null
                    ? t(`family.status_${a.status}`)
                    : t('family.points', { score: a.score, points: a.points })}
                  {a.status === 'late' ? ` · ${t('family.status_late')}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>{t('family.upcoming')}</h2>
      {report.upcoming.length === 0 ? (
        <p>{t('family.noUpcoming')}</p>
      ) : (
        <ul className="list" aria-label={t('family.upcoming')}>
          {report.upcoming.map((u, i) => (
            <li key={i}>
              {u.title} · {date(u.dueDate)}
            </li>
          ))}
        </ul>
      )}

      <h2>{t('family.attendance')}</h2>
      {attendance.summary.total === 0 ? (
        <p>{t('family.noAttendance')}</p>
      ) : (
        <>
          <p className="live-standing">
            {t('family.attendanceRate', { rate: attendance.rate ?? 0 })}
          </p>
          <ul className="list chips" aria-label={t('family.attendance')}>
            <li>
              {t('family.present')}: {attendance.summary.present}
            </li>
            <li>
              {t('family.absent')}: {attendance.summary.absent}
            </li>
            <li>
              {t('family.tardy')}: {attendance.summary.tardy}
            </li>
            <li>
              {t('family.excused')}: {attendance.summary.excused}
            </li>
          </ul>
          <h3>{t('family.recent')}</h3>
          <ul className="list" aria-label={t('family.recent')}>
            {attendance.recent.map((d) => (
              <li key={d.date}>
                {date(d.date)}: {t(`family.${d.status}`)}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>{t('family.learning')}</h2>
      {report.learning.length === 0 ? (
        <p>{t('family.noLearning')}</p>
      ) : (
        <ul className="list" aria-label={t('family.learning')}>
          {report.learning.map((s) => (
            <li key={s.subject}>
              {t(`assistant.subject_${s.subject}`)}:{' '}
              {t('family.lessons', { done: s.done, total: s.total })}
              {s.average === null ? '' : ` · ${String(s.average)}%`}
            </li>
          ))}
        </ul>
      )}

      <h2>{t('family.games')}</h2>
      <p>
        {games.plays === 0
          ? t('family.noGames')
          : t('family.gamesSummary', {
              plays: games.plays,
              best: games.best ?? 0,
              average: games.average ?? 0,
            })}
      </p>
    </main>
  );
}
