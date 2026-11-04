import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GameId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  GameDraftForm,
  GameEditor,
  GradingForm,
  ResultsForm,
} from '../../../../../components/game-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { formatDuration } from '../../../../../server/game-forms.ts';
import { contentText } from '../../../../../server/game-text.ts';
import { deleteGameAction } from '../../../../_lib/game-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; gameId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One game: edit it, share it, grade it, and see how the class did. */
export default async function GamePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { gameId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const details = await app.getGame.execute({ actor: user, gameId: gameId as GameId });
  if (!details.ok) notFound();
  const { game, modes } = details.value;
  const classes = (await app.listClasses.execute({ actor: user })).map((cls) => ({
    id: cls.id,
    name: cls.name,
  }));
  const categories =
    game.classId === null
      ? null
      : await app.listGradeCategories.execute({ actor: user, classId: game.classId });
  const categoryOptions = categories?.ok
    ? categories.value.map((c) => ({ id: c.id, name: c.name }))
    : [];
  const results = await app.getGameResults.execute({ actor: user, gameId: game.id });
  const insights = await app.getLiveInsights.execute({ actor: user, gameId: game.id });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/games`}>{t('games.list')}</Link>
      </p>
      <h1>{game.title}</h1>
      <p>{t('games.modes', { modes: modes.map((m) => t(`gameModes.${m}`)).join(', ') })}</p>
      <p>
        <Link className="button secondary" href={`/${locale}/app/games/${game.id}/play`}>
          {t('games.preview')}
        </Link>{' '}
        <Link className="button secondary" href={`/${locale}/app/live?game=${game.id}`}>
          {t('nav.live')}
        </Link>
      </p>
      <GameEditor
        locale={locale}
        classes={classes}
        gameId={game.id}
        label={t('games.save')}
        values={{
          title: game.title,
          mode: game.mode,
          content: contentText(game.content),
          classId: game.classId,
          language: game.language,
        }}
      />

      <h2>{t('games.gradingTitle')}</h2>
      {game.classId === null ? (
        <p>{t('games.gradingNeedsClass')}</p>
      ) : (
        <GradingForm
          locale={locale}
          gameId={game.id}
          categories={categoryOptions}
          grading={game.grading}
        />
      )}

      <h2>{t('games.results')}</h2>
      {!results.ok || results.value.summary.plays === 0 ? (
        <p>{t('games.noPlays')}</p>
      ) : (
        <>
          <p>
            {t('games.summary', {
              plays: results.value.summary.plays,
              students: results.value.summary.students,
              average: results.value.summary.averagePercent ?? 0,
            })}
          </p>
          <ResultsForm
            locale={locale}
            gameId={game.id}
            grading={game.grading.countAsGrade}
            rows={results.value.students.map((row) => ({
              studentId: row.studentId,
              name: row.name,
              attempts: row.attempts,
              bestPercent: row.bestPercent,
              lastPercent: row.lastPercent,
              lastPlayed: day.format(row.lastPlayedAt),
              draftScore: row.draftScore,
              confirmedScore: row.confirmedScore,
            }))}
          />
          <h3>{t('games.leaderboard')}</h3>
          <table className="table" aria-label={t('games.leaderboard')}>
            <thead>
              <tr>
                <th scope="col">{t('games.rank')}</th>
                <th scope="col">{t('games.name')}</th>
                <th scope="col">{t('games.score')}</th>
                <th scope="col">{t('games.time')}</th>
              </tr>
            </thead>
            <tbody>
              {results.value.leaderboard.map((entry) => (
                <tr key={entry.studentId}>
                  <td>{entry.rank}</td>
                  <td>{entry.name}</td>
                  <td>{entry.percent}%</td>
                  <td>{formatDuration(entry.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>{t('live.insightsTitle')}</h2>
      {!insights.ok || insights.value.sessions === 0 ? (
        <p>{t('live.noInsights')}</p>
      ) : (
        <>
          <p>
            {t('live.insightsSummary', {
              sessions: insights.value.sessions,
              participants: insights.value.participants,
              accuracy: insights.value.averageAccuracy ?? 0,
            })}
          </p>
          <p className="hint">{t('live.practiceNote')}</p>
          <h3>{t('live.hardest')}</h3>
          <table className="table" aria-label={t('live.hardest')}>
            <thead>
              <tr>
                <th scope="col">{t('live.question')}</th>
                <th scope="col">{t('live.answered')}</th>
                <th scope="col">{t('live.accuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {insights.value.questions.map((q) => (
                <tr key={q.prompt}>
                  <td>{q.prompt}</td>
                  <td>{q.answered}</td>
                  <td>{q.percentCorrect}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="table" aria-label={t('live.student')}>
            <thead>
              <tr>
                <th scope="col">{t('live.student')}</th>
                <th scope="col">{t('live.sessionsCount')}</th>
                <th scope="col">{t('live.answered')}</th>
                <th scope="col">{t('live.accuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {insights.value.students.map((s) => (
                <tr key={s.studentId}>
                  <td>{s.firstName}</td>
                  <td>{s.sessions}</td>
                  <td>{s.answered}</td>
                  <td>{s.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>{t('games.freshTitle')}</h2>
      <p>{t('games.freshIntro')}</p>
      <GameDraftForm locale={locale} gameId={game.id} mode={game.mode} topic={game.title} />

      <form action={deleteGameAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="gameId" value={game.id} />
        <button type="submit" className="button secondary">
          {t('games.delete')}
        </button>
      </form>
    </section>
  );
}
