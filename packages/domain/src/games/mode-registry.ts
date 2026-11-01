import type { ContentKind } from './content.ts';
import type { GameMode } from './game-mode.ts';
import { crosswordMode, type CrosswordView } from './modes/crossword.ts';
import { fillBlanksMode, type FillBlanksView } from './modes/fill-blanks.ts';
import {
  dragDropMode,
  sequenceMode,
  type DragDropView,
  type SequenceView,
} from './modes/order-modes.ts';
import {
  flashcardsMode,
  matchingMode,
  memoryMode,
  type FlashcardsView,
  type MatchingView,
  type MemoryView,
} from './modes/pair-modes.ts';
import { quizMode, timeAttackMode, type QuizView, type TimeAttackView } from './modes/quiz.ts';
import { trueFalseMode, type TrueFalseView } from './modes/true-false.ts';
import { wordSearchMode, type WordSearchView } from './modes/word-search.ts';

/** What a player sees for any mode; `mode` tells them apart. */
export type RoundView =
  | QuizView
  | TimeAttackView
  | TrueFalseView
  | FillBlanksView
  | FlashcardsView
  | MatchingView
  | MemoryView
  | WordSearchView
  | CrosswordView
  | SequenceView
  | DragDropView;

export type GameModeId = RoundView['mode'];

/** The game modes by id. A new mode is a new class registered here, never a new branch. */
export class GameModeRegistry {
  private readonly byId: ReadonlyMap<string, GameMode<RoundView>>;

  constructor(modes: readonly GameMode<RoundView>[]) {
    this.byId = new Map(modes.map((mode) => [mode.id, mode]));
  }

  all(): readonly GameMode<RoundView>[] {
    return [...this.byId.values()];
  }

  get(id: string): GameMode<RoundView> | null {
    return this.byId.get(id) ?? null;
  }

  /** The modes that can play this kind of content. */
  modesFor(kind: ContentKind): readonly GameMode<RoundView>[] {
    return this.all().filter((mode) => mode.plays(kind));
  }
}

export const defaultGameModes = new GameModeRegistry([
  quizMode,
  timeAttackMode,
  trueFalseMode,
  fillBlanksMode,
  flashcardsMode,
  matchingMode,
  memoryMode,
  wordSearchMode,
  crosswordMode,
  sequenceMode,
  dragDropMode,
]);
