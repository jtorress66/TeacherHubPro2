import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { ContentForm } from '../../../../components/assistant-forms.tsx';
import { PdfTestForm } from '../../../../components/assignment-tools.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The AI assistant: ask for content, send a test PDF to Google, and see everything made so far. */
export default async function AssistantPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const history = await app.listGenerations.execute({ actor: user });
  const classes = await app.listClasses.execute({ actor: user });
  const targets = (
    await Promise.all(
      classes.map(async (cls) => {
        const categories = await app.listGradeCategories.execute({ actor: user, classId: cls.id });
        return (categories.ok ? categories.value : []).map((category) => ({
          id: `${cls.id}|${category.id}`,
          name: `${cls.name} · ${category.name}`,
        }));
      }),
    )
  ).flat();
  const items = history.ok ? history.value : [];
  const listed = await app.listGoogleQuizzes.execute({ actor: user });
  const quizzes = listed.ok ? listed.value : [];
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <h1>{t('assistant.title')}</h1>
      <p>{t('assistant.intro')}</p>
      <ContentForm locale={locale} />
      <section id="pdf-test-card" className="card stack" aria-labelledby="pdf-test-heading">
        <h2 id="pdf-test-heading">{t('pdfTest.title')}</h2>
        <p>{t('pdfTest.intro')}</p>
        <PdfTestForm
          locale={locale}
          targets={targets}
          noClasses={
            <p className="hint">
              {t('pdfTest.noClasses')}{' '}
              <Link href={`/${locale}/app/classes`}>{t('pdfTest.createClass')}</Link>
            </p>
          }
        />
      </section>
      <h2>{t('googleQuiz.list')}</h2>
      {quizzes.length === 0 ? (
        <p>{t('googleQuiz.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('googleQuiz.list')}>
          {quizzes.map((quiz) => (
            <li key={quiz.id}>
              <Link href={`/${locale}/app/assistant/quizzes/${quiz.id}`}>{quiz.title}</Link>{' '}
              <span className="hint">{day.format(quiz.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <h2>{t('assistant.history')}</h2>
      {items.length === 0 ? (
        <p>{t('assistant.historyEmpty')}</p>
      ) : (
        <ul className="list" aria-label={t('assistant.history')}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/${locale}/app/assistant/${item.id}`}>
                {t(`assistant.type_${item.type}`)}: {item.topic}
              </Link>{' '}
              <span className="hint">
                {t(`assistant.subject_${item.subject}`)} · {item.grade} ·{' '}
                {day.format(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
