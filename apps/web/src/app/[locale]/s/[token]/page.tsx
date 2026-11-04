import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; token: string }> };

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** A student's own page, opened from their personal link: no account, no password. */
export default async function StudentPortalPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { token } = await props.params;
  const app = getAppContainer();
  const portal = await app.openStudentLink.execute({ token });
  if (!portal.ok) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('student.notFound')}
        </p>
      </main>
    );
  }
  const { firstName, className, schoolName, assignments, games } = portal.value;
  const learning = await app.listStudentPaths.execute({ token });
  const paths = learning.ok ? learning.value : [];
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });

  return (
    <main className="student-page stack">
      <p className="muted small">
        {schoolName} · {className}
      </p>
      <h1>{t('student.hello', { name: firstName })}</h1>
      <h2>{t('student.assignments')}</h2>
      {assignments.length === 0 ? (
        <p>{t('student.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('student.assignments')}>
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <Link href={`/${locale}/s/${token}/${assignment.id}`}>{assignment.title}</Link>{' '}
              <span className="chip">{t(`student.status_${assignment.status}`)}</span>
              {assignment.dueDate === null ? null : (
                <span className="muted small">
                  {' '}
                  {t('student.due', {
                    date: day.format(new Date(`${assignment.dueDate}T12:00:00Z`)),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {paths.length === 0 ? null : (
        <>
          <h2>{t('learning.yourPaths')}</h2>
          <ul className="list" aria-label={t('learning.yourPaths')}>
            {paths.map((path) => (
              <li key={path.id} className="stack">
                <Link href={`/${locale}/s/${token}/learn/${path.id}`}>{path.title}</Link>
                <progress
                  max={path.total}
                  value={path.done}
                  aria-label={t('learning.progressLabel', { done: path.done, total: path.total })}
                />
                <span className="muted small">
                  {t('learning.progressLabel', { done: path.done, total: path.total })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {games.length === 0 ? null : (
        <>
          <h2>{t('student.games')}</h2>
          <ul className="list" aria-label={t('student.games')}>
            {games.map((game) => (
              <li key={game.id}>
                <Link href={`/${locale}/s/${token}/games/${game.id}`}>{game.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
