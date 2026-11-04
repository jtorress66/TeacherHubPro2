import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { StudentId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; studentId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One student's learning: progress by subject, and each path's lessons with their scores. */
export default async function StudentLearningPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { studentId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getStudentLearning.execute({
    actor: user,
    studentId: studentId as StudentId,
  });
  if (!found.ok) notFound();
  const student = found.value;
  const base = `/${locale}/app/learning`;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const percent = (value: number | null) => (value === null ? '—' : `${String(value)}%`);

  return (
    <section className="stack">
      <p>
        <Link href={`${base}?class=${encodeURIComponent(student.classId)}`}>
          {t('learning.back')}
        </Link>
      </p>
      <h1>{t('learning.studentTitle', { name: `${student.firstName} ${student.lastName}` })}</h1>
      <p className="hint">{t('learning.practiceNote')}</p>

      <h2>{t('learning.bySubject')}</h2>
      <table className="table" aria-label={t('learning.bySubject')}>
        <thead>
          <tr>
            <th scope="col">{t('learning.subject')}</th>
            <th scope="col">{t('learning.lessonsDone')}</th>
            <th scope="col">{t('learning.average')}</th>
            <th scope="col">{t('learning.levels')}</th>
            <th scope="col">{t('learning.lastActivity')}</th>
          </tr>
        </thead>
        <tbody>
          {student.subjects.map((s) => (
            <tr key={s.subject}>
              <td>{t(`assistant.subject_${s.subject}`)}</td>
              <td>{t('learning.lessonsOf', { done: s.done, total: s.total })}</td>
              <td>{percent(s.average)}</td>
              <td>{t('learning.level', { level: s.level })}</td>
              <td>{s.lastActivity === null ? t('learning.never') : day.format(s.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t('learning.paths')}</h2>
      {student.paths.length === 0 ? <p>{t('learning.noPaths')}</p> : null}
      {student.paths.map(({ path, progress }) => (
        <article key={path.id} className="card stack">
          <h3>
            <Link href={`${base}/${path.id}`}>{path.title}</Link>{' '}
            <span className="chip">{t(`learning.status_${path.status}`)}</span>
          </h3>
          <p className="muted">
            {t(`assistant.subject_${path.subject}`)} · {t('learning.level', { level: path.level })}{' '}
            · {t('learning.lessonsOf', { done: progress.done, total: progress.total })}
          </p>
          <table className="table" aria-label={path.title}>
            <thead>
              <tr>
                <th scope="col">{t('learning.lessonTitle')}</th>
                <th scope="col">{t('learning.best')}</th>
                <th scope="col">{t('learning.attempts')}</th>
              </tr>
            </thead>
            <tbody>
              {path.lessons.map((lesson, index) => (
                <tr key={index}>
                  <td>{lesson.title}</td>
                  <td>{percent(progress.lessons[index]?.best ?? null)}</td>
                  <td>{progress.lessons[index]?.attempts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}
