import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../../../container.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; token: string; pathId: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** A student's path: its lessons in order, done ones marked. */
export default async function StudentPathPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { token, pathId } = await props.params;
  const paths = await getAppContainer().listStudentPaths.execute({ token });
  const path = paths.ok ? paths.value.find((p) => p.id === pathId) : undefined;
  const home = `/${locale}/s/${token}`;
  if (path === undefined) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('student.notFound')}
        </p>
      </main>
    );
  }

  return (
    <main className="student-page stack">
      <p>
        <Link href={home}>← {t('learning.yourPaths')}</Link>
      </p>
      <h1>{path.title}</h1>
      {path.description === '' ? null : <p>{path.description}</p>}
      <progress
        max={path.total}
        value={path.done}
        aria-label={t('learning.progressLabel', { done: path.done, total: path.total })}
      />
      <p className="muted">{t('learning.progressLabel', { done: path.done, total: path.total })}</p>
      <ol className="list lesson-list" aria-label={path.title}>
        {path.lessons.map((lesson, index) => (
          <li key={index}>
            <Link href={`${home}/learn/${path.id}/${String(index)}`}>{lesson.title}</Link>{' '}
            <span className="muted small">
              {t('learning.minutesShort', { minutes: lesson.minutes })}
            </span>{' '}
            {lesson.done ? (
              <span className="chip">
                {t('learning.done')} · {lesson.best ?? 0}%
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </main>
  );
}
