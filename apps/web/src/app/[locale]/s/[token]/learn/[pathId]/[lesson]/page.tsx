import type { Metadata } from 'next';
import Link from 'next/link';
import type { LearningPathId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { LessonCheck } from '../../../../../../../components/learning/lesson-check.tsx';
import { ReadAloud } from '../../../../../../../components/learning/read-aloud.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; token: string; pathId: string; lesson: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** One lesson: the reading (which can be read aloud), then the check. */
export default async function StudentLessonPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { token, pathId, lesson } = await props.params;
  const index = /^\d{1,2}$/u.test(lesson) ? Number(lesson) : -1;
  const found = await getAppContainer().openLearnerLesson.execute({
    token,
    pathId: pathId as LearningPathId,
    lesson: index,
  });
  if (!found.ok) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('student.notFound')}
        </p>
      </main>
    );
  }
  const view = found.value;
  const pathHref = `/${locale}/s/${token}/learn/${view.pathId}`;
  const next = view.index + 1 < view.count ? `${pathHref}/${String(view.index + 1)}` : null;

  return (
    <main className="student-page stack" lang={view.language}>
      <p>
        <Link href={pathHref}>← {view.pathTitle}</Link>
      </p>
      <p className="muted">
        {t('learning.lessonOf', { n: view.index + 1, total: view.count })} ·{' '}
        {t('learning.minutesShort', { minutes: view.lesson.minutes })}
      </p>
      <h1>{view.lesson.title}</h1>
      <p className="muted">{view.lesson.objective}</p>
      <p className="lesson-reading">{view.lesson.content}</p>
      <div className="button-row">
        <ReadAloud locale={locale} language={view.language} text={view.lesson.content} />
      </div>
      {view.best === null ? null : (
        <p className="chip">{t('learning.yourBest', { percent: view.best })}</p>
      )}
      <h2>{t('learning.checkTitle')}</h2>
      <LessonCheck
        locale={locale}
        token={token}
        pathId={view.pathId}
        lesson={view.index}
        checks={view.lesson.checks}
        nextHref={next}
        backHref={pathHref}
      />
    </main>
  );
}
