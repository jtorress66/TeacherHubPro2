'use client';

import type { LiveView } from '@thp/application';
import { createTranslator, type Locale } from '@thp/i18n';
import { AnswerOptions, optionLabel } from './answer-options.tsx';
import { useCountdown, useLiveSocket } from './use-live-socket.ts';

function Leaderboard({ view, locale }: { readonly view: LiveView; readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ol className="live-board" aria-label={t('live.leaderboard')}>
      {view.leaderboard.map((row) => (
        <li key={row.playerId}>
          <span className="live-rank">{row.rank}</span>
          <span className="live-name">{row.firstName}</span>
          <span className="live-score">{t('live.points', { points: row.score })}</span>
        </li>
      ))}
    </ol>
  );
}

/** The teacher's screen, made to be projected: PIN, players, questions, answers and rankings. */
export function HostScreen(props: {
  readonly locale: Locale;
  readonly realtimeUrl: string;
  readonly ticket: string;
  readonly joinUrl: string;
}) {
  const t = createTranslator(props.locale);
  const { view, receivedAt, state, error, send } = useLiveSocket(props.realtimeUrl, props.ticket);
  const seconds = useCountdown(view, receivedAt);
  if (view === null) {
    return <p role="status">{t(state === 'closed' ? 'live.reconnecting' : 'live.connecting')}</p>;
  }
  const players = view.players.length;
  const end = (
    <button
      type="button"
      className="button quiet"
      onClick={() => {
        send({ type: 'end' });
      }}
    >
      {t('live.end')}
    </button>
  );
  const joinPanel = (
    <div className="live-join">
      <p className="muted">{t('live.joinAt', { url: props.joinUrl })}</p>
      <p className="live-pin" aria-label={t('live.pin')} data-testid="live-pin">
        {view.pin}
      </p>
    </div>
  );

  return (
    <div className="stack live-stage">
      {state === 'closed' ? <p className="alert">{t('live.reconnecting')}</p> : null}
      {error !== null ? (
        <p className="alert">{t(`errors.${error}` as Parameters<typeof t>[0])}</p>
      ) : null}
      <h1>{view.title}</h1>

      {view.kind === 'self_paced' ? (
        <>
          {view.status !== 'ended' ? joinPanel : null}
          <h2>{t('live.studentsPlaying')}</h2>
          <table className="table" aria-label={t('live.studentsPlaying')}>
            <thead>
              <tr>
                <th scope="col">{t('live.student')}</th>
                <th scope="col">{t('live.rounds')}</th>
                <th scope="col">{t('live.best')}</th>
              </tr>
            </thead>
            <tbody>
              {(view.selfPaced ?? []).map((row) => (
                <tr key={row.playerId}>
                  <td>{row.firstName}</td>
                  <td>{row.plays}</td>
                  <td>{row.bestPercent === null ? '—' : `${String(row.bestPercent)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {view.status !== 'ended' ? end : <p>{t('live.status_ended')}</p>}
        </>
      ) : null}

      {view.kind === 'live' && view.status === 'lobby' ? (
        <>
          {joinPanel}
          <p role="status">
            {players === 0 ? t('live.waiting') : t('live.players', { count: players })}
          </p>
          <ul className="live-players" aria-label={t('live.players', { count: players })}>
            {view.players.map((player) => (
              <li key={player.id}>
                <span>{player.firstName}</span>
                <button
                  type="button"
                  className="link-button"
                  aria-label={t('live.remove', { name: player.firstName })}
                  onClick={() => {
                    send({ type: 'remove', playerId: player.id });
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button
              type="button"
              className="button accent large"
              disabled={players === 0}
              onClick={() => {
                send({ type: 'start' });
              }}
            >
              {t('live.startGame')}
            </button>
            {end}
          </div>
        </>
      ) : null}

      {view.kind === 'live' &&
      (view.status === 'question' || view.status === 'reveal') &&
      view.question ? (
        <>
          <p className="muted">
            {t('live.questionOf', { n: view.current + 1, total: view.questionCount })}
          </p>
          <h2 className="live-question">{view.question.prompt}</h2>
          {view.status === 'question' ? (
            <p role="timer" className="chip">
              {t('live.timeLeft', { seconds })} ·{' '}
              {t('live.answeredOf', { answered: view.answered, total: players })}
            </p>
          ) : null}
          <AnswerOptions
            locale={props.locale}
            question={view.question}
            correct={view.reveal?.correctChoice ?? null}
            counts={view.reveal?.stats.distribution ?? null}
          />
          {view.reveal ? (
            <>
              <p role="status" className="notice">
                {t('live.correctAnswer', {
                  answer: optionLabel(view.question, view.reveal.correctChoice, props.locale),
                })}
              </p>
              <h3>{t('live.leaderboard')}</h3>
              <Leaderboard view={view} locale={props.locale} />
              <div className="button-row">
                <button
                  type="button"
                  className="button large"
                  onClick={() => {
                    send({ type: 'next' });
                  }}
                >
                  {view.current + 1 >= view.questionCount ? t('live.finish') : t('live.next')}
                </button>
                {end}
              </div>
            </>
          ) : (
            <div className="button-row">{end}</div>
          )}
        </>
      ) : null}

      {view.kind === 'live' && view.status === 'ended' ? (
        <>
          <h2>{t('live.finalResults')}</h2>
          <Leaderboard view={view} locale={props.locale} />
        </>
      ) : null}
    </div>
  );
}
