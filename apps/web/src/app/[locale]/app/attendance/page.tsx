import type { Metadata } from 'next';
import Link from 'next/link';
import { parseLocalDate } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function AttendanceOverviewPage(
  props: LocaleParams & { readonly searchParams: Promise<{ date?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const requested = parseLocalDate('date', (await props.searchParams).date ?? '');
  const date = requested.ok ? requested.value : app.today(await teacherTimeZone());
  const overview = await app.getAttendanceOverview.execute({ actor: user, date });
  const classes = overview.ok ? overview.value : [];

  return (
    <section className="stack">
      <h1>{t('attendance.title')}</h1>
      <p className="muted">{t('attendance.overviewIntro')}</p>
      <form method="get" className="field-row">
        <div className="field">
          <label htmlFor="overview-date">{t('attendance.date')}</label>
          <input id="overview-date" type="date" name="date" defaultValue={date} />
        </div>
        <button type="submit" className="button secondary">
          {t('attendance.show')}
        </button>
      </form>
      {classes.length === 0 ? (
        <p className="muted">{t('attendance.noClasses')}</p>
      ) : (
        <table className="roster">
          <tbody>
            {classes.map(({ cls, status }) => (
              <tr key={cls.id}>
                <th scope="row">{cls.name}</th>
                <td>
                  <span className={`badge day-${status}`}>
                    {t(`attendance.dayStatus_${status}`)}
                  </span>
                </td>
                <td className="row-actions">
                  <Link
                    href={`/${locale}/app/classes/${cls.id}/attendance?date=${date}`}
                    aria-label={`${t('attendance.take')}: ${cls.name}`}
                  >
                    {t('attendance.take')}
                  </Link>
                  <Link
                    href={`/${locale}/app/classes/${cls.id}/attendance/report`}
                    aria-label={`${t('attendance.report')}: ${cls.name}`}
                  >
                    {t('attendance.report')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
