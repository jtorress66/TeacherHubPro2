import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GameId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { GamePlayer } from '../../../../../../components/game-player.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import {
  finishPreviewRoundAction,
  startPreviewRoundAction,
} from '../../../../../_lib/game-actions.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; gameId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The teacher plays their own game as a student would; nothing is saved. */
export default async function GamePreviewPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { gameId } = await props.params;
  const { user } = await requireUser(locale);
  const round = await getAppContainer().startPreviewRound.execute({
    actor: user,
    gameId: gameId as GameId,
  });
  if (!round.ok) notFound();

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/games/${gameId}`}>{t('gamePlay.back')}</Link>
      </p>
      <h1>{round.value.title}</h1>
      <GamePlayer
        locale={locale}
        initial={round.value}
        preview
        start={startPreviewRoundAction.bind(null, locale)}
        finish={finishPreviewRoundAction.bind(null, locale)}
      />
    </section>
  );
}
