import type { ValidationError } from '../shared/validation.ts';
import type { ContentKind, ContentOf, GameContent } from './content.ts';
import { convertContent, converts } from './conversions.ts';
import { seededRandom, type Random } from './random.ts';

/** How a finished round went: one result per scorable item. */
export interface RoundScore {
  readonly score: number;
  readonly total: number;
  readonly results: readonly boolean[];
}

export interface ModeView {
  readonly mode: string;
}

/**
 * A way to play a game. A mode only prepares rounds and scores them; the seed rebuilds the
 * same round, so the answer key never leaves the server and play-again is a new seed.
 */
export interface GameMode<V extends ModeView = ModeView> {
  readonly id: V['mode'];
  /** The kind of content the mode plays (other kinds may convert to it). */
  readonly kind: ContentKind;
  plays(kind: ContentKind): boolean;
  /** Rules beyond the content's own (e.g. word search letters); null when it suits. */
  unsuitable(content: GameContent): ValidationError | null;
  /** What the player sees: never the answers. */
  prepare(content: GameContent, seed: number): V;
  /** Perfect answers for the round. */
  solve(content: GameContent, seed: number): unknown;
  /** Scores the player's answers; malformed answers score as wrong and never throw. */
  score(content: GameContent, seed: number, answers: unknown): RoundScore;
}

export interface PreparedRound<V, Key> {
  readonly view: V;
  readonly key: Key;
}

export interface ModeDefinition<K extends ContentKind, V extends ModeView, Key> {
  readonly id: V['mode'];
  readonly kind: K;
  readonly unsuitable?: (content: ContentOf<K>) => ValidationError | null;
  prepare(content: ContentOf<K>, random: Random): PreparedRound<V, Key>;
  solve(key: Key): unknown;
  score(key: Key, answers: unknown): RoundScore;
}

/** Builds a mode from its typed parts: seeding and content conversion live here once. */
export function defineMode<K extends ContentKind, V extends ModeView, Key>(
  definition: ModeDefinition<K, V, Key>,
): GameMode<V> {
  const contentFor = (content: GameContent, random: Random): ContentOf<K> => {
    if (content.kind === definition.kind) return content as ContentOf<K>;
    const converted = convertContent(content, definition.kind, random);
    if (converted === null) {
      throw new Error(`${definition.id} cannot play ${content.kind} content`);
    }
    return converted as ContentOf<K>;
  };
  const round = (content: GameContent, seed: number): PreparedRound<V, Key> => {
    const random = seededRandom(seed);
    return definition.prepare(contentFor(content, random), random);
  };

  return {
    id: definition.id,
    kind: definition.kind,
    plays: (kind) => kind === definition.kind || converts(kind, definition.kind),
    unsuitable: (content) => definition.unsuitable?.(contentFor(content, seededRandom(0))) ?? null,
    prepare: (content, seed) => round(content, seed).view,
    solve: (content, seed) => definition.solve(round(content, seed).key),
    score: (content, seed, answers) => definition.score(round(content, seed).key, answers),
  };
}

/** The answers as a list; anything else is no answers. */
export const listOf = (answers: unknown): readonly unknown[] =>
  Array.isArray(answers) ? (answers as unknown[]) : [];

const normalised = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[.!?,;:]+$/u, '');

/** A typed answer matches regardless of case, accents, spacing or end punctuation. */
export const sameAnswer = (typed: unknown, expected: string): boolean =>
  typeof typed === 'string' && normalised(typed) === normalised(expected);

/** A term as the upper-case letters (or characters) a grid holds. */
export const gridLetters = (term: string): string[] =>
  Array.from(term.toLocaleUpperCase()).filter((char) => /[\p{L}\p{N}]/u.test(char));

/** Scores per-item results. */
export const scored = (results: readonly boolean[]): RoundScore => ({
  score: results.filter(Boolean).length,
  total: results.length,
  results,
});
