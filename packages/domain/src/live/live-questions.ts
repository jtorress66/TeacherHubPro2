import { playableModes, type Game } from '../games/game.ts';
import type { GameModeId, GameModeRegistry, RoundView } from '../games/mode-registry.ts';

/** One question as everyone sees it during a live session: never the answer. */
export interface LiveQuestion {
  readonly prompt: string;
  readonly options: readonly string[];
  /** `true_false` options are the words "true" and "false", translated on screen. */
  readonly style: 'choices' | 'true_false';
}

/** How a question mode's round becomes live questions, and how a tapped choice is answered. */
interface LiveFormat {
  readonly questions: (view: RoundView) => LiveQuestion[];
  /** The answer the mode's own scoring expects for a tapped choice. */
  readonly answerFor: (choice: number) => unknown;
}

const choiceFormat: LiveFormat = {
  questions: (view) =>
    'questions' in view
      ? view.questions.map((q) => ({ prompt: q.prompt, options: q.options, style: 'choices' }))
      : [],
  answerFor: (choice) => choice,
};

const trueFalseFormat: LiveFormat = {
  questions: (view) =>
    'statements' in view
      ? view.statements.map((statement) => ({
          prompt: statement,
          options: ['true', 'false'],
          style: 'true_false',
        }))
      : [],
  answerFor: (choice) => choice === 0,
};

/** The modes that can run live, one question at a time. A new one is a new entry. */
const liveFormats: Partial<Readonly<Record<GameModeId, LiveFormat>>> = {
  quiz: choiceFormat,
  true_false: trueFalseFormat,
};

/** The modes this game can be played live in. */
export const liveModes = (game: Game, modes: GameModeRegistry): GameModeId[] =>
  playableModes(game, modes)
    .map((mode) => mode.id)
    .filter((id) => liveFormats[id] !== undefined);

function liveRound(game: Game, modeId: string, modes: GameModeRegistry) {
  const format = liveFormats[modeId as GameModeId];
  const mode = playableModes(game, modes).find((m) => m.id === modeId);
  return format === undefined || mode === undefined ? null : { format, mode };
}

/** The session's questions, in the order the seed gives; null when the mode cannot run live. */
export function liveQuestions(
  game: Game,
  modeId: string,
  seed: number,
  modes: GameModeRegistry,
): LiveQuestion[] | null {
  const round = liveRound(game, modeId, modes);
  return round === null ? null : round.format.questions(round.mode.prepare(game.content, seed));
}

/** Whether a tapped choice answers the question, by the mode's own rules. */
export function isCorrectLiveAnswer(
  game: Game,
  modeId: string,
  seed: number,
  question: number,
  choice: number,
  modes: GameModeRegistry,
): boolean {
  const round = liveRound(game, modeId, modes);
  if (round === null || !Number.isInteger(choice) || choice < 0) return false;
  const shown = round.format.questions(round.mode.prepare(game.content, seed))[question];
  if (shown === undefined || choice >= shown.options.length) return false;
  const answers: unknown[] = [];
  answers[question] = round.format.answerFor(choice);
  return round.mode.score(game.content, seed, answers).results[question] === true;
}
