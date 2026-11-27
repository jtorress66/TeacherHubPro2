import { describe, expect, it } from 'vitest';
import type { GameContent } from './content.ts';
import { unexplainedItems, withExplanations } from './content-explanations.ts';

const questions: GameContent = {
  kind: 'questions',
  items: [
    { prompt: 'Largest planet?', options: ['Mars', 'Jupiter'], answer: 1 },
    {
      prompt: 'Closest to the Sun?',
      options: ['Mercury', 'Earth'],
      answer: 0,
      explanation: 'Mercury has the smallest orbit.',
    },
    { prompt: 'The red planet?', options: ['Saturn', 'Mars'], answer: 1, explanation: '  ' },
  ],
};

describe('unexplainedItems', () => {
  it('lists the questions with no explanation yet, with their options and right answer', () => {
    expect(unexplainedItems(questions)).toEqual([
      { index: 0, question: 'Largest planet?', options: ['Mars', 'Jupiter'], answer: 'Jupiter' },
      { index: 2, question: 'The red planet?', options: ['Saturn', 'Mars'], answer: 'Mars' },
    ]);
  });

  it('gives a statement’s truth and a sentence’s missing word as the answer', () => {
    expect(
      unexplainedItems({
        kind: 'statements',
        items: [{ statement: 'Mars is blue', isTrue: false }],
      }),
    ).toEqual([{ index: 0, question: 'Mars is blue', answer: 'false' }]);
    expect(
      unexplainedItems({ kind: 'sentences', items: [{ text: 'The ___ shines.', answer: 'Sun' }] }),
    ).toEqual([{ index: 0, question: 'The ___ shines.', answer: 'Sun' }]);
  });

  it('has nothing to explain in kinds whose answers are the words themselves', () => {
    expect(unexplainedItems({ kind: 'steps', items: ['Mix', 'Bake', 'Cool'] })).toEqual([]);
  });
});

describe('withExplanations', () => {
  it('fills only the items that had none, and never changes the teacher’s own', () => {
    const filled = withExplanations(
      questions,
      new Map([
        [0, 'Jupiter is the biggest planet.'],
        [1, 'Should not replace the teacher’s.'],
      ]),
    );
    expect(filled.items[0]).toMatchObject({ explanation: 'Jupiter is the biggest planet.' });
    expect(filled.items[1]).toMatchObject({ explanation: 'Mercury has the smallest orbit.' });
    expect(filled.items[2]).toMatchObject({ prompt: 'The red planet?', explanation: '  ' });
  });
});
