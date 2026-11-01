import { invalid } from '../../shared/validation.ts';
import { defineMode, gridLetters, listOf, scored } from '../game-mode.ts';
import { randomInt, type Random } from '../random.ts';

export type Cell = readonly [row: number, col: number];

export interface WordSearchView {
  readonly mode: 'word_search';
  readonly grid: readonly (readonly string[])[];
  /** The terms to find, as the teacher wrote them. */
  readonly words: readonly string[];
}

export const wordSearchLimits = { minLetters: 2, maxLetters: 12, maxWords: 15 } as const;

const directions: readonly Cell[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];
const triesPerWord = 300;
const minSize = 8;

interface Placement {
  readonly start: Cell;
  readonly end: Cell;
}

type Grid = (string | null)[][];

function fits(grid: Grid, letters: readonly string[], start: Cell, step: Cell): boolean {
  return letters.every((letter, k) => {
    const cell = grid[start[0] + step[0] * k]?.[start[1] + step[1] * k];
    return cell === null || cell === letter;
  });
}

function place(grid: Grid, letters: readonly string[], random: Random): Placement | null {
  const size = grid.length;
  for (let tries = 0; tries < triesPerWord; tries += 1) {
    const step = directions[randomInt(random, directions.length)] ?? [0, 1];
    const start: Cell = [randomInt(random, size), randomInt(random, size)];
    if (!fits(grid, letters, start, step)) continue;
    letters.forEach((letter, k) => {
      const row = grid[start[0] + step[0] * k];
      if (row !== undefined) row[start[1] + step[1] * k] = letter;
    });
    const last = letters.length - 1;
    return { start, end: [start[0] + step[0] * last, start[1] + step[1] * last] };
  }
  return null;
}

/** Places every word (longest first), growing the grid until they all fit, then fills it. */
export function buildWordSearch(
  words: readonly (readonly string[])[],
  random: Random,
): { grid: string[][]; placements: Placement[] } {
  const longest = Math.max(...words.map((word) => word.length));
  const letters = words.flat();
  const order = words
    .map((_, index) => index)
    .sort((a, b) => (words[b]?.length ?? 0) - (words[a]?.length ?? 0));
  for (
    let size = Math.max(minSize, longest, Math.ceil(Math.sqrt(letters.length * 2)));
    ;
    size += 1
  ) {
    const grid: Grid = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
    const placements: Placement[] = [];
    const placedAll = order.every((index) => {
      const placement = place(grid, words[index] ?? [], random);
      if (placement !== null) placements[index] = placement;
      return placement !== null;
    });
    if (placedAll) {
      const filled = grid.map((row) =>
        row.map((cell) => cell ?? letters[randomInt(random, letters.length)] ?? 'A'),
      );
      return { grid: filled, placements };
    }
  }
}

const isCell = (value: unknown): value is Cell =>
  Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n));

/** The letters along a straight line from start to end, or null when it is not straight. */
export function lettersAlong(
  grid: readonly (readonly string[])[],
  start: Cell,
  end: Cell,
): string | null {
  const rows = end[0] - start[0];
  const cols = end[1] - start[1];
  if (rows !== 0 && cols !== 0 && Math.abs(rows) !== Math.abs(cols)) return null;
  const length = Math.max(Math.abs(rows), Math.abs(cols)) + 1;
  const step: Cell = [Math.sign(rows), Math.sign(cols)];
  let letters = '';
  for (let k = 0; k < length; k += 1) {
    const letter = grid[start[0] + step[0] * k]?.[start[1] + step[1] * k];
    if (letter === undefined) return null;
    letters += letter;
  }
  return letters.toLocaleUpperCase();
}

/** Find the terms hidden in a grid; answers are selections [start, end], either direction. */
export const wordSearchMode = defineMode({
  id: 'word_search',
  kind: 'pairs',
  unsuitable(content) {
    if (content.items.length > wordSearchLimits.maxWords) return invalid('items', 'too_long').error;
    const bad = content.items.findIndex(({ term }) => {
      const length = gridLetters(term).length;
      return length < wordSearchLimits.minLetters || length > wordSearchLimits.maxLetters;
    });
    return bad === -1 ? null : invalid(`items.${String(bad)}.term`, 'out_of_range').error;
  },
  prepare(content, random) {
    const words = content.items.map(({ term }) => gridLetters(term));
    const { grid, placements } = buildWordSearch(words, random);
    const view: WordSearchView = {
      mode: 'word_search',
      grid,
      words: content.items.map(({ term }) => term),
    };
    return { view, key: { grid, words: words.map((w) => w.join('')), placements } };
  },
  solve: (key) => key.placements.map((placement) => [placement.start, placement.end]),
  score(key, answers) {
    const found = new Set<number>();
    for (const answer of listOf(answers)) {
      if (!Array.isArray(answer) || !isCell(answer[0]) || !isCell(answer[1])) continue;
      const along = lettersAlong(key.grid, answer[0], answer[1]);
      if (along === null) continue;
      const backwards = Array.from(along).reverse().join('');
      const word = key.words.findIndex(
        (w, index) => !found.has(index) && (w === along || w === backwards),
      );
      if (word !== -1) found.add(word);
    }
    return scored(key.words.map((_, index) => found.has(index)));
  },
});
