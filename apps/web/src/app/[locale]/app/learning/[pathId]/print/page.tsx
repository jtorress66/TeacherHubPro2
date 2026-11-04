import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LearningPathId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; pathId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The path on paper, for working offline: one lesson per page, the answer key at the end. */
export default async function PrintLearningPathPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { pathId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getLearningPath.execute({
    actor: user,
    pathId: pathId as LearningPathId,
  });
  if (!found.ok) notFound();
  const path = found.value;

  return (
    <article className="stack" data-testid="print-path">
      <p className="actions no-print">
        <Link href={`/${locale}/app/learning/${path.id}`}>← {t('learning.back')}</Link>
        <PrintButton locale={locale} />
      </p>
      <h1>{path.title}</h1>
      {path.description === '' ? null : <p>{path.description}</p>}
      {path.lessons.map((lesson, index) => (
        <section key={index} className="stack page-break">
          <h2>
            {t('learning.lesson', { n: index + 1 })}: {lesson.title}
          </h2>
          <p className="muted">
            {lesson.objective} · {t('learning.minutesShort', { minutes: lesson.minutes })}
          </p>
          <p className="lesson-reading">{lesson.content}</p>
          <h3>{t('learning.checkTitle')}</h3>
          <ol>
            {lesson.checks.map((check, c) => (
              <li key={c}>
                {check.prompt}
                <ul>
                  {check.options.map((option, o) => (
                    <li key={o}>☐ {option}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section className="stack page-break">
        <h2>{t('learning.answerKey')}</h2>
        {path.lessons.map((lesson, index) => (
          <p key={index}>
            <strong>{t('learning.lesson', { n: index + 1 })}:</strong>{' '}
            {lesson.checks
              .map((check, c) => `${String(c + 1)}. ${check.options[check.answer] ?? ''}`)
              .join(' · ')}
          </p>
        ))}
      </section>
    </article>
  );
}
