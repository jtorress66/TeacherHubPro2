import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId, StudentId, TimelineEvent } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { JobProgress } from '../../../../../../../components/job-progress.tsx';
import { AddNoteForm, InsightForm } from '../../../../../../../components/student360-forms.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { formatRate } from '../../../../../../../server/attendance-display.ts';
import { formatPercent } from '../../../../../../../server/gradebook-display.ts';
import { formatDate } from '../../../../../../../server/lesson-plan-display.ts';
import { deleteStudentNoteAction } from '../../../../../../_lib/student360-actions.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string; studentId: string }>;
  readonly searchParams: Promise<{ job?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

function eventText(event: TimelineEvent, locale: Locale): string {
  const t = createTranslator(locale);
  switch (event.kind) {
    case 'grade':
      return `${event.title}: ${t(`gradebook.status_${event.status}`)}${
        event.percentage === null ? '' : ` · ${formatPercent(event.percentage, locale)}`
      }`;
    case 'attendance':
      return [
        t(`attendance.status_${event.status}`),
        event.minutesLate === null
          ? null
          : t('student360.minutesLate', { minutes: event.minutesLate }),
        event.note,
      ]
        .filter((part) => part !== null)
        .join(' · ');
    case 'due':
      return `${t('student360.due', { title: event.title })} (${
        event.graded ? t('student360.graded') : t('student360.notGraded')
      })`;
    default:
      return `${t('student360.noteDate')}: ${event.text}`;
  }
}

/**
 * Student 360: one student's average, attendance and missing work, a timeline, the teacher's own
 * private notes, and an AI insight they can ask for.
 */
export default async function Student360Page(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId, studentId } = await props.params;
  const { job } = await props.searchParams;
  const { user } = await requireUser(locale);
  const view = await getAppContainer().getStudent360.execute({
    actor: user,
    classId: classId as ClassId,
    studentId: studentId as StudentId,
    timeZone: await teacherTimeZone(),
  });
  if (!view.ok) notFound();
  const { student, cls, summary, notes, insight } = view.value;
  const { stats } = summary;
  const path = `/${locale}/app/classes/${classId}/students/${studentId}`;
  const ids = { locale, classId, studentId };
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/classes/${cls.id}`}>← {t('student360.back')}</Link>
      </p>
      <h1>
        {student.firstName} {student.lastName}
      </h1>
      <p className="muted">
        {cls.name} · <Link href={`${path}/edit`}>{t('student360.edit')}</Link>
      </p>

      <dl className="stats" aria-label={student.firstName}>
        <div>
          <dt>{t('student360.average')}</dt>
          <dd data-testid="student-average">
            {stats.average === null ? t('student360.none') : formatPercent(stats.average, locale)}
            {stats.letter === null ? '' : ` (${stats.letter})`}
          </dd>
        </div>
        <div>
          <dt>{t('student360.attendanceRate')}</dt>
          <dd>{formatRate(stats.attendanceRate, locale)}</dd>
        </div>
        <div>
          <dt>{t('student360.missing')}</dt>
          <dd data-testid="student-missing">{stats.missing}</dd>
        </div>
      </dl>

      <section className="card stack" aria-labelledby="missing-heading">
        <h2 id="missing-heading">{t('student360.missing')}</h2>
        {summary.missing.length === 0 ? (
          <p className="muted">{t('student360.missingEmpty')}</p>
        ) : (
          <ul className="list">
            {summary.missing.map((assignment) => (
              <li key={assignment.id}>
                {assignment.title}
                {assignment.dueDate === null ? '' : ` · ${formatDate(assignment.dueDate, locale)}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="insight" className="card stack" aria-labelledby="insight-heading">
        <h2 id="insight-heading">{t('student360.insight')}</h2>
        <p className="hint">{t('student360.insightIntro')}</p>
        {job === undefined ? null : (
          <JobProgress
            locale={locale}
            jobId={job}
            doneHref={path}
            retryHref={path}
            labels={{
              working: t('student360.working'),
              failed: t('drafts.failed'),
              tryAgain: t('drafts.tryAgain'),
              open: t('student360.open'),
            }}
          />
        )}
        {insight === null ? null : (
          <div className="stack">
            <ul className="list" aria-label={t('student360.insight')}>
              {insight.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="hint">
              {t('student360.insightDraft', { date: day.format(insight.generatedAt) })}
            </p>
          </div>
        )}
        {job === undefined ? <InsightForm {...ids} again={insight !== null} /> : null}
      </section>

      <section className="card stack" aria-labelledby="notes-heading">
        <h2 id="notes-heading">{t('student360.notes')}</h2>
        <p className="hint">{t('student360.notesHint')}</p>
        {notes.length === 0 ? (
          <p className="muted">{t('student360.notesEmpty')}</p>
        ) : (
          <ul className="list" aria-label={t('student360.notes')}>
            {notes.map((note) => (
              <li key={note.id}>
                <span className="hint">{day.format(note.createdAt)}</span> {note.text}{' '}
                <form action={deleteStudentNoteAction} className="inline-form">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="classId" value={classId} />
                  <input type="hidden" name="studentId" value={studentId} />
                  <input type="hidden" name="noteId" value={note.id} />
                  <button type="submit" className="link-button">
                    {t('student360.deleteNote')}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddNoteForm {...ids} />
      </section>

      <section className="card stack" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">{t('student360.timeline')}</h2>
        {summary.timeline.length === 0 ? (
          <p className="muted">{t('student360.timelineEmpty')}</p>
        ) : (
          <ol className="list" aria-label={t('student360.timeline')}>
            {summary.timeline.map((event, index) => (
              <li key={`${event.kind}-${String(index)}`}>
                <span className="hint">
                  {event.date === null ? '—' : formatDate(event.date, locale)}
                </span>{' '}
                {eventText(event, locale)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
