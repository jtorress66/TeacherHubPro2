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
import { SendLtiGrades } from '../../../../../components/lti-grades.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { formatDuration } from '../../../../../server/game-forms.ts';
import { contentText } from '../../../../../server/game-text.ts';
import {
  addItemsFromGameAction,
  deleteGameAction,
  duplicateGameAction,
} from '../../../../_lib/game-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';
import { TableScroll } from '../../../../../components/table-scroll.tsx';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; gameId: string }>;
  readonly searchParams: Promise<{
    ltiJob?: string;
    ltiGrades?: string;
    copied?: string;
    added?: string;
    skipped?: string;
    addError?: string;
  }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

const addProblems = ['wrongKind', 'nothingNew', 'failed'] as const;

/** One game: edit it, share it, grade it, and see how the class did. */
export default async function GamePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { gameId } = await props.params;
  const { user } = await requireUser(locale);
  const search = await props.searchParams;
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
  const otherGames = (await app.listGames.execute({ actor: user })).filter((g) => g.id !== game.id);
  const addProblem = addProblems.find((problem) => problem === search.addError) ?? null;

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
      <form action={duplicateGameAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="gameId" value={game.id} />
        <input type="hidden" name="title" value={game.title} />
        <button type="submit" className="button secondary">
          {t('games.duplicate')}
        </button>
      </form>
      {search.copied === '1' ? (
        <p role="status" className="notice">
          {t('games.duplicated')}
        </p>
      ) : null}
      <GameEditor
        locale={locale}
        classes={classes}
        gameId={game.id}
        label={t('games.save')}
        values={{
          title: game.title,
          mode: game.mode,
          content: contentText(game.content),
          items: game.content,
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

      {game.classId === null || game.grading.assignmentId === null ? null : (
        <SendLtiGrades
          locale={locale}
          user={user}
          classId={game.classId}
          assignmentId={game.grading.assignmentId}
          path={`/${locale}/app/games/${game.id}`}
          jobId={search.ltiJob}
          problem={search.ltiGrades}
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
          <TableScroll>
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
          </TableScroll>
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
          <TableScroll>
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
          </TableScroll>
          <TableScroll>
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
          </TableScroll>
        </>
      )}

      <h2>{t('games.freshTitle')}</h2>
      <p>{t('games.freshIntro')}</p>
      <GameDraftForm locale={locale} gameId={game.id} mode={game.mode} topic={game.title} />

      <section className="card stack" aria-labelledby="add-items-heading">
        <h2 id="add-items-heading">{t('games.addFromTitle')}</h2>
        <p className="hint">{t('games.addFromHint')}</p>
        {search.added === undefined ? null : (
          <p role="status" className="notice">
            {t('games.addedItems', {
              added: Number(search.added) || 0,
              skipped: Number(search.skipped) || 0,
            })}
          </p>
        )}
        {addProblem === null ? null : (
          <p role="alert" className="field-error">
            {t(`games.addFrom_${addProblem}`)}
          </p>
        )}
        {otherGames.length === 0 ? (
          <p className="muted">{t('games.addFromNone')}</p>
        ) : (
          <form action={addItemsFromGameAction} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="gameId" value={game.id} />
            <div className="field">
              <label htmlFor="add-from-game">{t('games.addFromGame')}</label>
              <select id="add-from-game" name="sourceId">
                {otherGames.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.title}
                  </option>
                ))}
              </select>
            </div>
            <p>
              <button type="submit" className="button secondary">
                {t('games.addFromSubmit')}
              </button>
            </p>
          </form>
        )}
      </section>

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
