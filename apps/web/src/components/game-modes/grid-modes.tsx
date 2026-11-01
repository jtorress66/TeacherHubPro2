'use client';

import { useState } from 'react';
import {
  gridLetters,
  lettersAlong,
  type Cell,
  type CrosswordView,
  type WordSearchView,
} from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import type { RendererProps } from './renderer.ts';

const at = (row: number, col: number) => `${String(row)},${String(col)}`;

/** The cells from start to end along a straight line (empty when it is not straight). */
function cellsAlong(start: Cell, end: Cell): Cell[] {
  const rows = end[0] - start[0];
  const cols = end[1] - start[1];
  if (rows !== 0 && cols !== 0 && Math.abs(rows) !== Math.abs(cols)) return [];
  const length = Math.max(Math.abs(rows), Math.abs(cols)) + 1;
  return Array.from({ length }, (_, k) => [
    start[0] + Math.sign(rows) * k,
    start[1] + Math.sign(cols) * k,
  ]);
}

/** Click a word's first letter, then its last; found words stay marked. */
export function WordSearchRound({ view, locale, onDone }: RendererProps<WordSearchView>) {
  const t = createTranslator(locale);
  const targets = view.words.map((word) => gridLetters(word).join(''));
  const [start, setStart] = useState<Cell | null>(null);
  const [found, setFound] = useState<readonly number[]>([]);
  const [selections, setSelections] = useState<readonly (readonly [Cell, Cell])[]>([]);
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());

  const choose = (cell: Cell) => {
    if (start === null) {
      setStart(cell);
      return;
    }
    setStart(null);
    const along = lettersAlong(view.grid, start, cell);
    if (along === null) return;
    const backwards = Array.from(along).reverse().join('');
    const word = targets.findIndex(
      (target, i) => !found.includes(i) && (target === along || target === backwards),
    );
    if (word === -1) return;
    const nextFound = [...found, word];
    const nextSelections = [...selections, [start, cell] as const];
    setFound(nextFound);
    setSelections(nextSelections);
    setMarked(new Set([...marked, ...cellsAlong(start, cell).map(([r, c]) => at(r, c))]));
    if (nextFound.length === targets.length) onDone(nextSelections);
  };

  return (
    <div className="stack">
      <p className="hint">{t('gamePlay.wordSearchHelp')}</p>
      <div
        className="letter-grid"
        style={{ gridTemplateColumns: `repeat(${String(view.grid.length)}, 2rem)` }}
      >
        {view.grid.map((row, r) =>
          row.map((letter, c) => (
            <button
              key={at(r, c)}
              type="button"
              className={`letter-cell${marked.has(at(r, c)) ? ' found' : ''}`}
              aria-pressed={start?.[0] === r && start[1] === c}
              aria-label={t('gamePlay.cell', { row: r + 1, col: c + 1, letter })}
              data-cell={at(r, c)}
              onClick={() => {
                choose([r, c]);
              }}
            >
              {letter}
            </button>
          )),
        )}
      </div>
      <h3>{t('gamePlay.wordsToFind')}</h3>
      <ul className="word-list" aria-label={t('gamePlay.wordsToFind')}>
        {view.words.map((word, i) => (
          <li key={word} className={found.includes(i) ? 'found' : undefined}>
            {word}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          onDone(selections);
        }}
      >
        {t('gamePlay.check')}
      </button>
    </div>
  );
}

/** Type each word from its clue; the grid shows the letters as they are typed. */
export function CrosswordRound({ view, locale, onDone }: RendererProps<CrosswordView>) {
  const t = createTranslator(locale);
  const [answers, setAnswers] = useState<string[]>(view.clues.map(() => ''));
  const letters = new Map<string, string>();
  const numbers = new Map<string, number>();
  view.clues.forEach((clue, i) => {
    numbers.set(at(clue.row, clue.col), clue.number);
    const typed = gridLetters(answers[i] ?? '');
    for (let k = 0; k < clue.length; k += 1) {
      const key =
        clue.direction === 'across' ? at(clue.row, clue.col + k) : at(clue.row + k, clue.col);
      const letter = typed[k];
      if (letter !== undefined || !letters.has(key)) letters.set(key, letter ?? '');
    }
  });
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onDone(answers);
      }}
    >
      <div
        className="crossword-grid"
        aria-hidden="true"
        style={{ gridTemplateColumns: `repeat(${String(view.cols)}, 2rem)` }}
      >
        {Array.from({ length: view.rows }, (_, r) =>
          Array.from({ length: view.cols }, (_, c) => {
            const key = at(r, c);
            const letter = letters.get(key);
            return (
              <span
                key={key}
                className={letter === undefined ? 'crossword-block' : 'crossword-cell'}
              >
                {numbers.has(key) ? <sup>{numbers.get(key)}</sup> : null}
                {letter}
              </span>
            );
          }),
        )}
      </div>
      {view.clues.map((clue, i) => (
        <div className="field" key={`${String(clue.number)}-${clue.direction}`}>
          <label htmlFor={`clue-${String(i)}`}>
            {t('gamePlay.clue', {
              number: clue.number,
              direction: t(`gamePlay.${clue.direction}`),
              clue: clue.clue,
            })}
          </label>
          <input
            id={`clue-${String(i)}`}
            maxLength={clue.length + 4}
            value={answers[i] ?? ''}
            onChange={(event) => {
              const next = [...answers];
              next[i] = event.target.value;
              setAnswers(next);
            }}
          />
        </div>
      ))}
      <button type="submit" className="button">
        {t('gamePlay.check')}
      </button>
    </form>
  );
}
