import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GoogleQuizId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PostQuizForm } from '../../../../../../components/assignment-tools.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; quizId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One of the teacher's Google Forms quizzes: its links, and posting it to Classroom. */
export default async function GoogleQuizPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { quizId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const quiz = await app.findGoogleQuiz.execute({ actor: user, quizId: quizId as GoogleQuizId });
  if (!quiz.ok) notFound();
  const courses = await app.listClassroomCourses.execute({ actor: user });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/assistant`}>← {t('googleQuiz.back')}</Link>
      </p>
      <h1>{quiz.value.title}</h1>
      <p role="status" className="notice">
        {t('forms.made')}
      </p>
      <p>
        {t('googleQuiz.madeOn', { date: day.format(quiz.value.createdAt) })} ·{' '}
        <a href={quiz.value.editUrl}>{t('forms.edit')}</a> ·{' '}
        <a href={quiz.value.responderUrl}>{t('forms.studentLink')}</a>
      </p>
      <p className="hint">{t('forms.note')}</p>
      <section className="card stack" aria-labelledby="post-quiz-heading">
        <h2 id="post-quiz-heading">{t('googleQuiz.post')}</h2>
        {courses.ok ? (
          <PostQuizForm
            locale={locale}
            quizId={quiz.value.id}
            courses={courses.value.map((course) => ({ id: course.id, name: course.name }))}
          />
        ) : (
          <p>
            <a className="button" href={`/api/classroom/connect?locale=${locale}`}>
              {t('pdfTest.connect')}
            </a>
          </p>
        )}
      </section>
    </section>
  );
}
