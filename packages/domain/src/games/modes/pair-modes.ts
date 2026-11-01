import { defineMode, listOf, scored } from '../game-mode.ts';
import { shuffle } from '../random.ts';

export interface FlashcardsView {
  readonly mode: 'flashcards';
  readonly cards: readonly { readonly term: string; readonly definition: string }[];
}

/** Flip each card; answers say per card whether the student knew it. */
export const flashcardsMode = defineMode({
  id: 'flashcards',
  kind: 'pairs',
  prepare(content, random) {
    const view: FlashcardsView = { mode: 'flashcards', cards: shuffle(content.items, random) };
    return { view, key: view.cards.length };
  },
  solve: (key) => Array.from({ length: key }, () => true),
  score(key, answers) {
    const knew = listOf(answers);
    return scored(Array.from({ length: key }, (_, index) => knew[index] === true));
  },
});

export interface MatchingView {
  readonly mode: 'matching';
  readonly terms: readonly string[];
  readonly definitions: readonly string[];
}

/** Answers give, per term, the index of the chosen definition. */
export const matchingMode = defineMode({
  id: 'matching',
  kind: 'pairs',
  prepare(content, random) {
    const terms = shuffle(content.items, random);
    const definitions = shuffle(content.items, random);
    const view: MatchingView = {
      mode: 'matching',
      terms: terms.map((pair) => pair.term),
      definitions: definitions.map((pair) => pair.definition),
    };
    return { view, key: terms.map((pair) => definitions.indexOf(pair)) };
  },
  solve: (key) => key,
  score(key, answers) {
    const chosen = listOf(answers);
    return scored(key.map((definition, index) => chosen[index] === definition));
  },
});

export interface MemoryCard {
  readonly text: string;
  readonly side: 'term' | 'definition';
}

/**
 * Memory is about remembering where cards are: once two cards are turned, both texts show, so the
 * view says which cards belong together and the player can keep the pairs found face up.
 */
export interface MemoryView {
  readonly mode: 'memory';
  readonly cards: readonly MemoryCard[];
  /** For each card, the number of its pair. */
  readonly pairOf: readonly number[];
}

const isCardPair = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((card) => typeof card === 'number') &&
  value[0] !== value[1];

/** Turn over two cards to find a term and its definition; answers are the pairs found. */
export const memoryMode = defineMode({
  id: 'memory',
  kind: 'pairs',
  prepare(content, random) {
    const cards = shuffle(
      content.items.flatMap((pair, index) => [
        { card: { text: pair.term, side: 'term' as const }, pair: index },
        { card: { text: pair.definition, side: 'definition' as const }, pair: index },
      ]),
      random,
    );
    const view: MemoryView = {
      mode: 'memory',
      cards: cards.map((c) => c.card),
      pairOf: cards.map((c) => c.pair),
    };
    return { view, key: { pairs: content.items.length, cardPairs: cards.map((c) => c.pair) } };
  },
  solve: (key) =>
    Array.from({ length: key.pairs }, (_, pair) =>
      key.cardPairs.flatMap((cardPair, card) => (cardPair === pair ? [card] : [])),
    ),
  score(key, answers) {
    const found = new Set<number>();
    for (const answer of listOf(answers)) {
      if (!isCardPair(answer)) continue;
      const [first, second] = answer.map((card) => key.cardPairs[card]);
      if (first !== undefined && first === second) found.add(first);
    }
    return scored(Array.from({ length: key.pairs }, (_, pair) => found.has(pair)));
  },
});
