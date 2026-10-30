import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseLocalDate, planWeekdays, seatingRows, weekOnDate, type ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../../components/browser-helpers.tsx';
import { Markdown } from '../../../../../../../components/markdown.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { formatDate } from '../../../../../../../server/lesson-plan-display.ts';
import { scheduleSummary } from '../../../../../../../server/schedule-summary.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string }>;
  readonly searchParams: Promise<{ date?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

const seatsPerRow = 5;

/** The substitute packet for one day, ready to print. */
export default async function PrintSubPacketPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user, school } = await requireUser(locale);
  const app = getAppContainer();
  const date = (await props.searchParams).date ?? app.today(await teacherTimeZone());
  const found = await app.getSubPacket.execute({ actor: user, classId: classId as ClassId, date });
  if (!found.ok) notFound();
  const { cls, semester, students, plan, notes } = found.value;
  const day = parseLocalDate('date', date);
  const week = plan === null || !day.ok ? null : weekOnDate(plan, day.value);
  const name = (s: (typeof students)[number]) => `${s.firstName} ${s.lastName}`;
  const none = t('subPacket.none');

  return (
    <article className="stack print-plan" data-testid="print-sub-packet">
      <p className="actions no-print">
        <Link href={`/${locale}/app/classes/${cls.id}/sub-packet`}>← {t('subPacket.title')}</Link>
        <PrintButton locale={locale} />
      </p>
      <header>
        <p className="muted small">{school.name}</p>
        <h1>
          {t('subPacket.title')}: {cls.name}
        </h1>
        <p>{day.ok ? formatDate(day.value, locale) : date}</p>
      </header>

      <section className="stack">
        <h2>{t('subPacket.emergency')}</h2>
        <dl className="facts">
          <div>
            <dt>{t('subPacket.mainOfficeExt')}</dt>
            <dd>{notes.mainOfficeExt ?? none}</dd>
          </div>
          <div>
            <dt>{t('subPacket.nurseExt')}</dt>
            <dd>{notes.nurseExt ?? none}</dd>
          </div>
        </dl>
        <h3>{t('subPacket.emergencyProcedures')}</h3>
        <Markdown source={notes.emergencyProcedures ?? none} />
      </section>

      <section className="stack">
        <h2>{t('subPacket.classInfo')}</h2>
        <dl className="facts">
          <div>
            <dt>{t('subPacket.subject')}</dt>
            <dd>{cls.subject ?? none}</dd>
          </div>
          <div>
            <dt>{t('subPacket.semester')}</dt>
            <dd>{semester?.name ?? none}</dd>
          </div>
          <div>
            <dt>{t('subPacket.schedule')}</dt>
            <dd>{scheduleSummary(cls.schedule, locale) || none}</dd>
          </div>
        </dl>
      </section>

      <section className="stack">
        <h2>{t('subPacket.plan')}</h2>
        {plan === null || week === null || plan.body.kind !== 'weekly' ? (
          <p>{t('subPacket.noPlan')}</p>
        ) : (
          <>
            <dl className="facts">
              <div>
                <dt>{t('subPacket.unit')}</dt>
                <dd>{plan.body.unit ?? none}</dd>
              </div>
              <div>
                <dt>{t('subPacket.objective')}</dt>
                <dd>{week.objective ?? none}</dd>
              </div>
            </dl>
            <table className="print-days">
              <thead>
                <tr>
                  <th scope="col">{t('subPacket.day')}</th>
                  <th scope="col">{t('subPacket.theme')}</th>
                  <th scope="col">{t('subPacket.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {planWeekdays.map((weekday, i) => (
                  <tr key={weekday}>
                    <th scope="row">{t(`planner.day_${weekday}`)}</th>
                    <td>{week.days[i]?.theme ?? ''}</td>
                    <td>
                      <Markdown source={week.days[i]?.notes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="stack page-break">
        <h2>{t('subPacket.roster', { count: students.length })}</h2>
        {students.length === 0 ? (
          <p>{t('subPacket.noStudents')}</p>
        ) : (
          <table className="print-days">
            <thead>
              <tr>
                <th scope="col">{t('subPacket.number')}</th>
                <th scope="col">{t('subPacket.student')}</th>
                {notes.includeAccommodations ? (
                  <th scope="col">{t('subPacket.accommodations')}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => (
                <tr key={student.id}>
                  <td>{i + 1}</td>
                  <td>
                    {name(student)}
                    {student.studentNumber === null ? '' : ` (${student.studentNumber})`}
                  </td>
                  {notes.includeAccommodations ? <td>{student.accommodations ?? ''}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h2>{t('subPacket.seating')}</h2>
        <p className="seating-front">{t('subPacket.front')}</p>
        <div className="seating" role="list" aria-label={t('subPacket.seating')}>
          {seatingRows(students, seatsPerRow).flatMap((row, r) =>
            row.map((student) => (
              <span key={`${String(r)}-${student.id}`} className="seat" role="listitem">
                {name(student)}
              </span>
            )),
          )}
        </div>
      </section>

      <section className="stack page-break">
        <h2>{t('subPacket.subNotes')}</h2>
        <h3>{t('subPacket.dailyRoutines')}</h3>
        <Markdown source={notes.dailyRoutines ?? none} />
        <h3>{t('subPacket.additionalNotes')}</h3>
        <Markdown source={notes.additionalNotes ?? none} />
      </section>
      <p className="muted small">{t('planner.printedOn')}</p>
    </article>
  );
}
