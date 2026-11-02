'use client';

import { useEffect, useState } from 'react';
import type { FillBlanksView, FlashcardsView, MatchingView, MemoryView } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import type { RendererProps } from './renderer.ts';

const textOf = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

export function FillBlanksRound({ view, locale, onDone }: RendererProps<FillBlanksView>) {
  const t = createTranslator(locale);
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onDone(view.sentences.map((_, i) => textOf(data, `blank-${String(i)}`)));
      }}
    >
      <p>
        <strong>{t('gamePlay.wordBank')}:</strong> {view.wordBank.join(' · ')}
      </p>
      <ol className="stack">
        {view.sentences.map((sentence, i) => (
          <li key={`${sentence.before}-${String(i)}`}>
            <label htmlFor={`blank-${String(i)}`} className="visually-hidden">
              {t('gamePlay.answerFor', { n: i + 1 })}
            </label>
            {sentence.before}
            <input id={`blank-${String(i)}`} name={`blank-${String(i)}`} className="blank-input" />
            {sentence.after}
          </li>
        ))}
      </ol>
      <button type="submit" className="button">
        {t('gamePlay.check')}
      </button>
    </form>
  );
}

/** Flip each card, then say whether you knew it. */
export function FlashcardsRound({ view, locale, onDone }: RendererProps<FlashcardsView>) {
  const t = createTranslator(locale);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knew, setKnew] = useState<boolean[]>([]);
  const card = view.cards[index];
  if (card === undefined) return null;
  const answer = (value: boolean) => {
    const next = [...knew, value];
    setKnew(next);
    setFlipped(false);
    if (index + 1 === view.cards.length) onDone(next);
    else setIndex(index + 1);
  };
  return (
    <div className="stack">
      <p className="muted small">
        {t('gamePlay.progress', { n: index + 1, total: view.cards.length })}
      </p>
      <div className="flashcard" aria-live="polite">
        <p className="flashcard-term">{card.term}</p>
        {flipped ? <p>{card.definition}</p> : null}
      </div>
      {flipped ? (
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => {
              answer(true);
            }}
          >
            {t('gamePlay.knewIt')}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              answer(false);
            }}
          >
            {t('gamePlay.stillLearning')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setFlipped(true);
          }}
        >
          {t('gamePlay.flip')}
        </button>
      )}
    </div>
  );
}

export function MatchingRound({ view, locale, onDone }: RendererProps<MatchingView>) {
  const t = createTranslator(locale);
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onDone(
          view.terms.map((_, i) => {
            const chosen = textOf(data, `match-${String(i)}`);
            return chosen === '' ? -1 : Number(chosen);
          }),
        );
      }}
    >
      {view.terms.map((term, i) => (
        <div className="field" key={term}>
          <label htmlFor={`match-${String(i)}`}>{t('gamePlay.definitionFor', { term })}</label>
          <select id={`match-${String(i)}`} name={`match-${String(i)}`} defaultValue="">
            <option value="">{t('gamePlay.choose')}</option>
            {view.definitions.map((definition, d) => (
              <option key={definition} value={d}>
                {definition}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="submit" className="button">
        {t('gamePlay.check')}
      </button>
    </form>
  );
}

const mismatchMs = 900;

/** Turn over two cards at a time; a term and its definition stay face up. */
export function MemoryRound({ view, locale, onDone }: RendererProps<MemoryView>) {
  const t = createTranslator(locale);
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set());
  const [turns, setTurns] = useState<[number, number][]>([]);

  useEffect(() => {
    if (up.length < 2) return;
    const timer = setTimeout(() => {
      setUp([]);
    }, mismatchMs);
    return () => {
      clearTimeout(timer);
    };
  }, [up]);

  const turn = (card: number) => {
    if (matched.has(card) || up.includes(card) || up.length === 2) return;
    if (up.length === 0) {
      setUp([card]);
      return;
    }
    const first = up[0] ?? card;
    const nextTurns: [number, number][] = [...turns, [first, card]];
    setTurns(nextTurns);
    if (view.pairOf[first] === view.pairOf[card]) {
      const nextMatched = new Set([...matched, first, card]);
      setMatched(nextMatched);
      setUp([]);
      if (nextMatched.size === view.cards.length) onDone(nextTurns);
    } else {
      setUp([first, card]);
    }
  };

  return (
    <div className="stack">
      <p role="status">
        {t('gamePlay.pairsFound', { found: matched.size / 2, total: view.cards.length / 2 })}
      </p>
      <div className="memory-grid">
        {view.cards.map((card, i) => {
          const faceUp = matched.has(i) || up.includes(i);
          return (
            <button
              key={`${card.text}-${String(i)}`}
              type="button"
              className={`memory-card${matched.has(i) ? ' found' : ''}`}
              aria-label={faceUp ? card.text : t('gamePlay.card', { n: i + 1 })}
              aria-pressed={faceUp}
              onClick={() => {
                turn(i);
              }}
            >
              {faceUp ? card.text : '?'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
