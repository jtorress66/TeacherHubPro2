'use client';

import { useEffect, useState } from 'react';
import type { GameRound, LiveView } from '@thp/application';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  finishSelfPacedRoundAction,
  startSelfPacedRoundAction,
} from '../../app/_lib/live-actions.ts';
import { GamePlayer } from '../game-player.tsx';
import { AnswerOptions } from './answer-options.tsx';
import { useCountdown, useLiveSocket } from './use-live-socket.ts';

/** A self-paced session: the student plays the game with the regular player. */
function SelfPaced(props: {
  readonly locale: Locale;
  readonly ticket: string;
  /** After a round is saved, so the host's table shows it. */
  readonly onFinished: () => void;
}) {
  const [round, setRound] = useState<GameRound | null>(null);
  useEffect(() => {
    void startSelfPacedRoundAction(props.ticket, { gameId: 'self-paced' }).then((reply) => {
      if (reply.ok) setRound(reply.round);
    });
  }, [props.ticket]);
  if (round === null) return null;
  return (
    <GamePlayer
      locale={props.locale}
      initial={round}
      preview={false}
      start={startSelfPacedRoundAction.bind(null, props.ticket)}
      finish={async (input) => {
        const reply = await finishSelfPacedRoundAction(props.ticket, input);
        if (reply.ok) props.onFinished();
        return reply;
      }}
    />
  );
}

function Standing({ view, locale }: { readonly view: LiveView; readonly locale: Locale }) {
  const t = createTranslator(locale);
  if (view.you === null) return null;
  return (
    <p className="live-standing">
      {t('play.rank', { rank: view.you.rank, points: view.you.score })}
      {view.you.streak > 1 ? ` ${t('play.streak', { count: view.you.streak })}` : ''}
    </p>
  );
}

/** A student's device during a session: answer buttons, then how it went. */
export function PlayerScreen(props: {
  readonly locale: Locale;
  readonly realtimeUrl: string;
  readonly ticket: string;
}) {
  const t = createTranslator(props.locale);
  const { view, receivedAt, state, send } = useLiveSocket(props.realtimeUrl, props.ticket);
  const seconds = useCountdown(view, receivedAt);
  if (view === null) {
    return <p role="status">{t(state === 'closed' ? 'live.reconnecting' : 'live.connecting')}</p>;
  }
  const name = view.you?.firstName ?? '';

  return (
    <div className="stack live-player">
      {state === 'closed' ? <p className="alert">{t('live.reconnecting')}</p> : null}
      <h1>{view.title}</h1>

      {view.kind === 'self_paced' && view.status === 'open' ? (
        <SelfPaced
          locale={props.locale}
          ticket={props.ticket}
          onFinished={() => {
            send({ type: 'refresh' });
          }}
        />
      ) : null}

      {view.status === 'lobby' ? <p role="status">{t('play.waiting', { name })}</p> : null}

      {view.status === 'question' && view.question ? (
        <>
          <p className="muted">
            {t('live.questionOf', { n: view.current + 1, total: view.questionCount })} ·{' '}
            {t('live.timeLeft', { seconds })}
          </p>
          <h2 className="live-question">{view.question.prompt}</h2>
          {view.you?.answeredCurrent ? (
            <p role="status">{t('play.answered')}</p>
          ) : (
            <AnswerOptions
              locale={props.locale}
              question={view.question}
              onChoose={(choice) => {
                send({ type: 'answer', question: view.current, choice });
              }}
            />
          )}
        </>
      ) : null}

      {view.status === 'reveal' ? (
        <>
          <p role="status" className={view.you?.lastAnswer?.correct ? 'notice' : 'alert'}>
            {view.you?.lastAnswer === null || view.you?.lastAnswer === undefined
              ? t('play.missed')
              : view.you.lastAnswer.correct
                ? t('play.correct', { points: view.you.lastAnswer.points })
                : t('play.wrong')}
          </p>
          <Standing view={view} locale={props.locale} />
        </>
      ) : null}

      {view.status === 'ended' ? (
        <>
          <p role="status" className="game-result">
            {t('play.ended')}
          </p>
          {view.kind === 'live' ? <Standing view={view} locale={props.locale} /> : null}
        </>
      ) : null}
    </div>
  );
}
