import { describe, expect, it } from 'vitest';
import type { ContentOf } from '../content.ts';
import { fillBlanksMode } from './fill-blanks.ts';
import { matchingMode } from './pair-modes.ts';
import { quizMode, timeAttackMode } from './quiz.ts';
import { trueFalseMode } from './true-false.ts';

const questions: ContentOf<'questions'> = {
  kind: 'questions',
  items: [
    {
      prompt: 'Largest?',
      options: ['Mars', 'Jupiter', 'Venus'],
      answer: 1,
      explanation: 'Jupiter is the biggest planet.',
    },
    { prompt: 'Closest?', options: ['Mercury', 'Earth'], answer: 0 },
    { prompt: 'Red?', options: ['Saturn', 'Mars'], answer: 1 },
  ],
};

describe('the review after a round', () => {
  it('lists only the missed questions, with the chosen and the right option and why', () => {
    const view = quizMode.prepare(questions, 9);
    const right = quizMode.solve(questions, 9) as number[];
    const largest = view.questions.findIndex((q) => q.prompt === 'Largest?');
    const wrong = view.questions[largest]?.options.indexOf('Venus') ?? -1;
    const answers = right.map((answer, index) => (index === largest ? wrong : answer));

    expect(quizMode.review(questions, 9, answers)).toEqual([
      {
        prompt: 'Largest?',
        given: { text: 'Venus' },
        right: { text: 'Jupiter' },
        explanation: 'Jupiter is the biggest planet.',
      },
    ]);
  });

  it('shows a question left unanswered when time ran out with no given answer', () => {
    const view = timeAttackMode.prepare(questions, 2);
    const right = timeAttackMode.solve(questions, 2) as number[];
    const review = timeAttackMode.review(questions, 2, right.slice(0, 2));
    expect(review).toEqual([
      expect.objectContaining({ prompt: view.questions[2]?.prompt, given: null }),
    ]);
  });

  it('gives null as the explanation of a question that has none', () => {
    const view = quizMode.prepare(questions, 4);
    const right = quizMode.solve(questions, 4) as number[];
    const closest = view.questions.findIndex((q) => q.prompt === 'Closest?');
    const answers = right.map((answer, index) => (index === closest ? -1 : answer));
    expect(quizMode.review(questions, 4, answers)).toEqual([
      { prompt: 'Closest?', given: null, right: { text: 'Mercury' }, explanation: null },
    ]);
  });

  it('is empty when every answer is right', () => {
    expect(quizMode.review(questions, 3, quizMode.solve(questions, 3))).toEqual([]);
  });

  it('reviews true or false statements as true or false', () => {
    const statements: ContentOf<'statements'> = {
      kind: 'statements',
      items: [
        { statement: 'Mars is blue.', isTrue: false, explanation: 'Rust makes it red.' },
        { statement: 'The Sun is a star.', isTrue: true },
        { statement: 'Earth has one moon.', isTrue: true },
      ],
    };
    const right = trueFalseMode.solve(statements, 5) as boolean[];
    const view = trueFalseMode.prepare(statements, 5);
    const mars = view.statements.indexOf('Mars is blue.');
    const answers = right.map((truth, index) => (index === mars ? !truth : truth));

    expect(trueFalseMode.review(statements, 5, answers)).toEqual([
      {
        prompt: 'Mars is blue.',
        given: { truth: true },
        right: { truth: false },
        explanation: 'Rust makes it red.',
      },
    ]);
  });

  it('reviews a fill-in sentence with the blank, the typed word and the right word', () => {
    const sentences: ContentOf<'sentences'> = {
      kind: 'sentences',
      items: [
        { text: 'Water boils at ___ °C.', answer: '100', explanation: 'At sea level.' },
        { text: 'The ___ is our star.', answer: 'Sun' },
        { text: 'Plants need ___ to grow.', answer: 'light' },
      ],
    };
    const view = fillBlanksMode.prepare(sentences, 7);
    const water = view.sentences.findIndex((s) => s.before === 'Water boils at ');
    const right = fillBlanksMode.solve(sentences, 7) as string[];
    const answers = right.map((word, index) => (index === water ? '90' : word));

    expect(fillBlanksMode.review(sentences, 7, answers)).toEqual([
      {
        prompt: 'Water boils at ___ °C.',
        given: { text: '90' },
        right: { text: '100' },
        explanation: 'At sea level.',
      },
    ]);
  });

  it('has nothing to review in modes whose answers are the words themselves', () => {
    const pairs: ContentOf<'pairs'> = {
      kind: 'pairs',
      items: [
        { term: 'Sun', definition: 'Our star' },
        { term: 'Moon', definition: 'Earth’s satellite' },
        { term: 'Comet', definition: 'Icy body with a tail' },
        { term: 'Orbit', definition: 'Path around a body' },
      ],
    };
    expect(matchingMode.review(pairs, 1, [])).toEqual([]);
  });
});
