import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { ContentForm } from '../../../../components/assistant-forms.tsx';
import { PostWordForm } from '../../../../components/assignment-tools.tsx';
import { getAppContainer } from '../../../../container.ts';
import { curriculumChoices } from '../../../../server/curriculum-choices.ts';
import { assistantStart } from '../../../../server/reteach-prefill.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * The AI assistant: ask for content, send a Word document to Google Classroom or Microsoft Teams,
 * and see everything made so far.
 */
type Props = LocaleParams & {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssistantPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const history = await app.listGenerations.execute({ actor: user });
  const courses = await app.listClassroomCourses.execute({ actor: user });
  const teamsClasses = (await app.teams?.listClasses.execute({ actor: user })) ?? null;
  const items = history.ok ? history.value : [];
  const { guides } = await app.listCurriculumGuides.execute({ actor: user });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const connect = `/api/classroom/connect?locale=${locale}`;
  const start = assistantStart(await props.searchParams);

  return (
    <section className="stack">
      <h1>{t('assistant.title')}</h1>
      <p>{t('assistant.intro')}</p>
      {start === undefined ? null : (
        <p className="notice" role="status">
          {t('assistant.prefilled')}
        </p>
      )}
      <ContentForm locale={locale} curriculum={curriculumChoices(guides)} start={start} />
      <section id="word-post-card" className="card stack" aria-labelledby="word-post-heading">
        <h2 id="word-post-heading">{t('wordPost.title')}</h2>
        <p>{t('wordPost.intro')}</p>
        {!courses.ok ? (
          <div className="stack">
            <p className="muted">{t('google.connectFirst')}</p>
            <p>
              <a className="button" href={connect}>
                {t('google.connect')}
              </a>
            </p>
          </div>
        ) : courses.value.length === 0 ? (
          <div className="stack">
            <p className="notice" role="status">
              {t('google.noCourses')}
            </p>
            <p>
              <a className="button secondary" href={connect}>
                {t('google.switchAccount')}
              </a>
            </p>
          </div>
        ) : (
          <PostWordForm
            locale={locale}
            courses={courses.value.map((course) => ({ id: course.id, name: course.name }))}
          />
        )}
      </section>
      {teamsClasses?.ok === true && teamsClasses.value.length > 0 ? (
        <section
          id="teams-word-post-card"
          className="card stack"
          aria-labelledby="teams-word-post-heading"
        >
          <h2 id="teams-word-post-heading">{t('teams.wordTitle')}</h2>
          <p>{t('teams.wordIntro')}</p>
          <PostWordForm locale={locale} courses={teamsClasses.value} destination="teams" />
        </section>
      ) : null}
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
