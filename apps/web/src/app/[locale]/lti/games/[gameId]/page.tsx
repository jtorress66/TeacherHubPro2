import type { Metadata } from 'next';
import type { GameId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { GamePlayer } from '../../../../../components/game-player.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { finishPassRoundAction, startPassRoundAction } from '../../../../_lib/game-actions.ts';
import { passFor } from '../../../../_lib/lti-pass.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; gameId: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * A game a student opened from their course system: their pass (a cookie from the launch) opens
 * this one game, and each round is scored on the server and saved as theirs.
 */
export default async function LtiStudentGamePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { gameId } = await props.params;
  const id = gameId as GameId;
  const app = getAppContainer();
  const round =
    app.lti === null
      ? null
      : await app.startGameRound.execute({ pass: await passFor({ kind: 'game', id }), gameId: id });
  if (round?.ok !== true) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('lti.problem_expired')}
        </p>
      </main>
    );
  }
  return (
    <main className="student-page stack">
      <h1>{round.value.title}</h1>
      <GamePlayer
        locale={locale}
        initial={round.value}
        preview={false}
        start={startPassRoundAction}
        finish={finishPassRoundAction}
      />
    </main>
  );
}
