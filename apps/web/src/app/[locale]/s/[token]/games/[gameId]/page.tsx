import type { Metadata } from 'next';
import Link from 'next/link';
import type { GameId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { GamePlayer } from '../../../../../../components/game-player.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { formatDuration } from '../../../../../../server/game-forms.ts';
import {
  finishStudentRoundAction,
  startStudentRoundAction,
} from '../../../../../_lib/game-actions.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; token: string; gameId: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** A game from the student's link: each round is scored on the server and tied to them. */
export default async function StudentGamePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { token, gameId } = await props.params;
  const app = getAppContainer();
  const round = await app.startGameRound.execute({ token, gameId: gameId as GameId });
  if (!round.ok) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('gamePlay.notFound')}
        </p>
      </main>
    );
  }
  const board = await app.getGameLeaderboard.execute({ token, gameId: gameId as GameId });

  return (
    <main className="student-page stack">
      <p>
        <Link href={`/${locale}/s/${token}`}>{t('student.backHome')}</Link>
      </p>
      <h1>{round.value.title}</h1>
      <GamePlayer
        locale={locale}
        initial={round.value}
        preview={false}
        start={startStudentRoundAction.bind(null, token)}
        finish={finishStudentRoundAction.bind(null, token)}
      />
      {board.ok && board.value.length > 0 ? (
        <>
          <h2>{t('games.leaderboard')}</h2>
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
              {board.value.map((row) => (
                <tr key={row.rank} aria-current={row.you ? 'true' : undefined}>
                  <td>{row.rank}</td>
                  <td>
                    {row.name}
                    {row.you ? ` (${t('gamePlay.you')})` : ''}
                  </td>
                  <td>{row.percent}%</td>
                  <td>{formatDuration(row.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </main>
  );
}
