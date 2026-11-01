'use client';

import { useState, type ComponentType } from 'react';
import type { GameModeId, RoundView } from '@thp/domain';
import type { GameRound, RoundResult } from '@thp/application';
import { createTranslator, type Locale } from '@thp/i18n';
import type {
  FinishReply,
  FinishRoundInput,
  RoundReply,
  StartRoundInput,
} from '../app/_lib/game-actions.ts';
import {
  FillBlanksRound,
  FlashcardsRound,
  MatchingRound,
  MemoryRound,
} from './game-modes/card-modes.tsx';
import { QuizRound, TimeAttackRound, TrueFalseRound } from './game-modes/choice-modes.tsx';
import { CrosswordRound, WordSearchRound } from './game-modes/grid-modes.tsx';
import { DragDropRound, SequenceRound } from './game-modes/order-modes.tsx';
import type { RendererProps } from './game-modes/renderer.ts';

/** One player per mode: a new mode adds an entry here, never a branch. */
const renderers: {
  readonly [M in GameModeId]: ComponentType<RendererProps<Extract<RoundView, { mode: M }>>>;
} = {
  quiz: QuizRound,
  time_attack: TimeAttackRound,
  true_false: TrueFalseRound,
  fill_blanks: FillBlanksRound,
  flashcards: FlashcardsRound,
  matching: MatchingRound,
  memory: MemoryRound,
  word_search: WordSearchRound,
  crossword: CrosswordRound,
  sequence: SequenceRound,
  drag_drop: DragDropRound,
};

function Round(props: RendererProps<RoundView>) {
  const Renderer = renderers[props.view.mode] as ComponentType<RendererProps<RoundView>>;
  return <Renderer {...props} />;
}

/**
 * Plays a game: the round comes from the server without its answers, and the answers go back to
 * be scored there. Play again asks for a new round (a new shuffle), free.
 */
export function GamePlayer(props: {
  readonly locale: Locale;
  readonly initial: GameRound;
  readonly preview: boolean;
  readonly start: (input: StartRoundInput) => Promise<RoundReply>;
  readonly finish: (input: FinishRoundInput) => Promise<FinishReply>;
}) {
  const t = createTranslator(props.locale);
  const modeName = (mode: GameModeId) => t(`gameModes.${mode}`);
  const [round, setRound] = useState(props.initial);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [result, setResult] = useState<RoundResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const begin = async (mode: GameModeId) => {
    setBusy(true);
    const reply = await props.start({ gameId: round.gameId, mode });
    setBusy(false);
    setFailed(!reply.ok);
    if (!reply.ok) return;
    setRound(reply.round);
    setResult(null);
    setStartedAt(Date.now());
  };

  const done = async (answers: unknown) => {
    setBusy(true);
    const reply = await props.finish({
      gameId: round.gameId,
      mode: round.mode,
      seed: round.seed,
      answers,
      durationMs: Date.now() - startedAt,
    });
    setBusy(false);
    setFailed(!reply.ok);
    if (reply.ok) setResult(reply.result);
  };

  return (
    <div className="stack game-player" lang={round.language}>
      {props.preview ? <p className="chip">{t('gamePlay.previewNote')}</p> : null}
      {round.modes.length > 1 ? (
        <div className="field">
          <label htmlFor="game-mode">{t('gamePlay.chooseMode')}</label>
          <select
            id="game-mode"
            value={round.mode}
            disabled={busy}
            onChange={(event) => {
              void begin(event.target.value as GameModeId);
            }}
          >
            {round.modes.map((mode) => (
              <option key={mode} value={mode}>
                {modeName(mode)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="muted">{modeName(round.mode)}</p>
      )}
      {failed ? (
        <p role="alert" className="alert">
          {t('gamePlay.error')}
        </p>
      ) : null}
      {result === null ? (
        <Round
          key={`${round.mode}-${String(round.seed)}`}
          view={round.view}
          locale={props.locale}
          onDone={(answers) => {
            if (!busy) void done(answers);
          }}
        />
      ) : (
        <div className="stack">
          <p role="status" className="game-result">
            {t('gamePlay.result', {
              score: result.score,
              total: result.total,
              percent: result.percent,
            })}
          </p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => {
              void begin(round.mode);
            }}
          >
            {t('gamePlay.playAgain')}
          </button>
        </div>
      )}
    </div>
  );
}
