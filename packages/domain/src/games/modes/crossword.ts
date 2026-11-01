import { invalid } from '../../shared/validation.ts';
import { defineMode, gridLetters, listOf, scored } from '../game-mode.ts';
import { seededRandom, shuffle, type Random } from '../random.ts';

export interface CrosswordClue {
  readonly number: number;
  readonly direction: 'across' | 'down';
  readonly row: number;
  readonly col: number;
  readonly length: number;
  readonly clue: string;
}

export interface CrosswordView {
  readonly mode: 'crossword';
  readonly rows: number;
  readonly cols: number;
  readonly clues: readonly CrosswordClue[];
}

export const crosswordLimits = { minLetters: 2, maxLetters: 15, minPlaced: 4 } as const;

const attempts = 12;

interface Word {
  readonly index: number;
  readonly letters: readonly string[];
}

export interface PlacedWord extends Word {
  readonly row: number;
  readonly col: number;
  readonly across: boolean;
}

interface Square {
  readonly letter: string;
  across: boolean;
  down: boolean;
}

const at = (row: number, col: number): string => `${String(row)},${String(col)}`;

class Board {
  private readonly squares = new Map<string, Square>();
  readonly placed: PlacedWord[] = [];

  fits(letters: readonly string[], row: number, col: number, across: boolean): boolean {
    const [dr, dc] = across ? [0, 1] : [1, 0];
    if (this.squares.has(at(row - dr, col - dc))) return false;
    if (this.squares.has(at(row + dr * letters.length, col + dc * letters.length))) return false;
    let crossings = 0;
    for (const [k, letter] of letters.entries()) {
      const r = row + dr * k;
      const c = col + dc * k;
      const square = this.squares.get(at(r, c));
      if (square !== undefined) {
        if (square.letter !== letter || (across ? square.across : square.down)) return false;
        crossings += 1;
      } else if (this.squares.has(at(r + dc, c + dr)) || this.squares.has(at(r - dc, c - dr))) {
        return false;
      }
    }
    return crossings > 0 || this.placed.length === 0;
  }

  place(word: Word, row: number, col: number, across: boolean): void {
    const [dr, dc] = across ? [0, 1] : [1, 0];
    word.letters.forEach((letter, k) => {
      const key = at(row + dr * k, col + dc * k);
      const square = this.squares.get(key) ?? { letter, across: false, down: false };
      if (across) square.across = true;
      else square.down = true;
      this.squares.set(key, square);
    });
    this.placed.push({ ...word, row, col, across });
  }

  /** Where the word could cross the board's words. */
  candidates(word: Word): { row: number; col: number; across: boolean }[] {
    const found: { row: number; col: number; across: boolean }[] = [];
    for (const placed of this.placed) {
      for (const [p, letter] of placed.letters.entries()) {
        const row = placed.row + (placed.across ? 0 : p);
        const col = placed.col + (placed.across ? p : 0);
        for (const [k, own] of word.letters.entries()) {
          if (own !== letter) continue;
          const start = placed.across
            ? { row: row - k, col, across: false }
            : { row, col: col - k, across: true };
          if (this.fits(word.letters, start.row, start.col, start.across)) found.push(start);
        }
      }
    }
    return found;
  }
}

function layoutOnce(words: readonly Word[], random: Random): PlacedWord[] {
  const order = shuffle(words, random).sort((a, b) => b.letters.length - a.letters.length);
  const board = new Board();
  for (const word of order) {
    if (board.placed.length === 0) {
      board.place(word, 0, 0, random() < 0.5);
      continue;
    }
    const options = board.candidates(word);
    const choice = options[Math.floor(random() * options.length)];
    if (choice !== undefined) board.place(word, choice.row, choice.col, choice.across);
  }
  return board.placed;
}

/** The best of several greedy layouts, moved so the top-left square is (0, 0). */
export function layoutCrossword(words: readonly Word[], random: Random): PlacedWord[] {
  let best: PlacedWord[] = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const layout = layoutOnce(words, random);
    if (layout.length > best.length) best = layout;
  }
  const top = Math.min(...best.map((w) => w.row));
  const left = Math.min(...best.map((w) => w.col));
  return best.map((w) => ({ ...w, row: w.row - top, col: w.col - left }));
}

const wordsOf = (terms: readonly string[]): Word[] =>
  terms.map((term, index) => ({ index, letters: gridLetters(term) }));

/** Type each term from its definition; answers are the typed words per clue. */
export const crosswordMode = defineMode({
  id: 'crossword',
  kind: 'pairs',
  unsuitable(content) {
    const bad = content.items.findIndex(({ term }) => {
      const length = gridLetters(term).length;
      return length < crosswordLimits.minLetters || length > crosswordLimits.maxLetters;
    });
    if (bad !== -1) return invalid(`items.${String(bad)}.term`, 'out_of_range').error;
    const placed = layoutCrossword(
      wordsOf(content.items.map((pair) => pair.term)),
      seededRandom(0),
    );
    return placed.length < crosswordLimits.minPlaced
      ? invalid('items', 'invalid_format').error
      : null;
  },
  prepare(content, random) {
    const placed = layoutCrossword(wordsOf(content.items.map((pair) => pair.term)), random).sort(
      (a, b) => a.row - b.row || a.col - b.col || Number(b.across) - Number(a.across),
    );
    const numbers = new Map<string, number>();
    for (const word of placed) {
      if (!numbers.has(at(word.row, word.col)))
        numbers.set(at(word.row, word.col), numbers.size + 1);
    }
    const clues: CrosswordClue[] = placed.map((word) => ({
      number: numbers.get(at(word.row, word.col)) ?? 0,
      direction: word.across ? 'across' : 'down',
      row: word.row,
      col: word.col,
      length: word.letters.length,
      clue: content.items[word.index]?.definition ?? '',
    }));
    const view: CrosswordView = {
      mode: 'crossword',
      rows: Math.max(...placed.map((w) => w.row + (w.across ? 1 : w.letters.length))),
      cols: Math.max(...placed.map((w) => w.col + (w.across ? w.letters.length : 1))),
      clues,
    };
    return { view, key: placed.map((word) => word.letters.join('')) };
  },
  solve: (key) => key,
  score(key, answers) {
    const typed = listOf(answers);
    return scored(
      key.map((word, index) => {
        const answer = typed[index];
        return typeof answer === 'string' && gridLetters(answer).join('') === word;
      }),
    );
  },
});
