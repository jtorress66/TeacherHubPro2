import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LearningPathId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PathEditor } from '../../../../../components/learning/path-editor.tsx';
import { getAppContainer } from '../../../../../container.ts';
import {
  archivePathAction,
  assignPathAction,
  deletePathAction,
} from '../../../../_lib/learning-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; pathId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One path: edit and assign a draft; archive, print or delete any path. */
export default async function LearningPathPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { pathId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const found = await app.getLearningPath.execute({
    actor: user,
    pathId: pathId as LearningPathId,
  });
  if (!found.ok) notFound();
  const path = found.value;
  const student = await app.getStudentLearning.execute({
    actor: user,
    studentId: path.studentId,
  });
  const name = student.ok ? `${student.value.firstName} ${student.value.lastName}` : '';
  const base = `/${locale}/app/learning`;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pathId" value={path.id} />
      <input type="hidden" name="classId" value={path.classId} />
    </>
  );

  return (
    <section className="stack">
      <p>
        <Link href={`${base}?class=${encodeURIComponent(path.classId)}`}>{t('learning.back')}</Link>
      </p>
      <h1>{path.title}</h1>
      <p>
        <span className="chip">{t(`learning.status_${path.status}`)}</span>{' '}
        {t('learning.forStudent', { name })} · {t(`assistant.subject_${path.subject}`)} ·{' '}
        {t('learning.level', { level: path.level })}
      </p>
      <div className="button-row">
        {path.status === 'draft' ? (
          <form action={assignPathAction}>
            {hidden}
            <button type="submit" className="button accent">
              {t('learning.assign')}
            </button>
          </form>
        ) : null}
        {path.status === 'assigned' ? (
          <form action={archivePathAction}>
            {hidden}
            <button type="submit" className="button secondary">
              {t('learning.archive')}
            </button>
          </form>
        ) : null}
        <Link className="button secondary" href={`${base}/${path.id}/print`}>
          {t('learning.print')}
        </Link>
        <form action={deletePathAction}>
          {hidden}
          <button type="submit" className="button quiet">
            {t('learning.delete')}
          </button>
        </form>
      </div>
      {path.status === 'draft' ? (
        <>
          <p className="hint">{t('learning.assignHint')}</p>
          <PathEditor
            locale={locale}
            pathId={path.id}
            language={path.language}
            initial={{ title: path.title, description: path.description, lessons: path.lessons }}
          />
        </>
      ) : (
        <>
          <p className="hint">
            {t('learning.readOnly', { status: t(`learning.status_${path.status}`) })}
          </p>
          {path.lessons.map((lesson, index) => (
            <article key={index} className="card stack">
              <h2>
                {t('learning.lesson', { n: index + 1 })}: {lesson.title}
              </h2>
              <p className="muted">{lesson.objective}</p>
              <p className="lesson-reading">{lesson.content}</p>
              <ol>
                {lesson.checks.map((check, c) => (
                  <li key={c}>
                    {check.prompt} <strong>{check.options[check.answer]}</strong>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
