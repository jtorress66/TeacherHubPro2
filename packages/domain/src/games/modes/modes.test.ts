import { describe, expect, it } from 'vitest';
import type { ContentOf } from '../content.ts';
import { gridLetters } from '../game-mode.ts';
import { seededRandom } from '../random.ts';
import { crosswordMode, layoutCrossword } from './crossword.ts';
import { fillBlanksMode } from './fill-blanks.ts';
import { dragDropMode, sequenceMode } from './order-modes.ts';
import { flashcardsMode, matchingMode, memoryMode } from './pair-modes.ts';
import { quizMode, timeAttackMode, timeAttackSeconds } from './quiz.ts';
import { trueFalseMode } from './true-false.ts';
import { buildWordSearch, lettersAlong, wordSearchMode, type Cell } from './word-search.ts';

const pairs: ContentOf<'pairs'> = {
  kind: 'pairs',
  items: [
    { term: 'Sun', definition: 'Our star' },
    { term: 'Moon', definition: 'Earth’s satellite' },
    { term: 'Comet', definition: 'Icy body with a tail' },
    { term: 'Orbit', definition: 'Path around a body' },
    { term: 'Planet', definition: 'Travels around a star' },
  ],
};

describe('quiz and time attack', () => {
  const questions: ContentOf<'questions'> = {
    kind: 'questions',
    items: [
      { prompt: 'Largest?', options: ['Mars', 'Jupiter', 'Venus'], answer: 1 },
      { prompt: 'Closest?', options: ['Mercury', 'Earth'], answer: 0 },
      { prompt: 'Red?', options: ['Saturn', 'Mars'], answer: 1 },
    ],
  };

  it('scores the chosen option per shown question', () => {
    const view = quizMode.prepare(questions, 9);
    const answers = view.questions.map((q) => {
      const item = questions.items.find((i) => i.prompt === q.prompt);
      return q.options.indexOf(item?.options[item.answer] ?? '');
    });
    expect(quizMode.score(questions, 9, answers).score).toBe(3);
    expect(quizMode.score(questions, 9, [answers[0], -1]).results).toEqual([true, false, false]);
  });

  it('time attack gives a time limit and scores unanswered questions as wrong', () => {
    const view = timeAttackMode.prepare(questions, 2);
    expect(view.seconds).toBe(timeAttackSeconds);
    const solved = timeAttackMode.solve(questions, 2) as number[];
    expect(timeAttackMode.score(questions, 2, solved.slice(0, 1)).score).toBe(1);
  });

  it('a quiz of term and definition pairs asks each term with four definitions', () => {
    const view = quizMode.prepare(pairs, 4);
    expect(view.questions.map((q) => q.prompt).sort()).toEqual([
      'Comet',
      'Moon',
      'Orbit',
      'Planet',
      'Sun',
    ]);
    expect(view.questions.every((q) => q.options.length === 4)).toBe(true);
  });
});

describe('true or false', () => {
  it('scores true or false per statement', () => {
    const statements: ContentOf<'statements'> = {
      kind: 'statements',
      items: [
        { statement: 'The Sun is a star', isTrue: true },
        { statement: 'The Moon is a planet', isTrue: false },
        { statement: 'Mars is red', isTrue: true },
      ],
    };
    const view = trueFalseMode.prepare(statements, 1);
    const answers = view.statements.map(
      (s) => statements.items.find((i) => i.statement === s)?.isTrue,
    );
    expect(trueFalseMode.score(statements, 1, answers).score).toBe(3);
    expect(
      trueFalseMode.score(
        statements,
        1,
        answers.map((a) => (a === true ? 'true' : a)),
      ).score,
    ).toBe(1);
  });
});

describe('fill in the blanks', () => {
  const sentences: ContentOf<'sentences'> = {
    kind: 'sentences',
    items: [
      { text: 'The Sun is a ___.', answer: 'star' },
      { text: '___ is red.', answer: 'Mars' },
      { text: 'Water ___ at 100 degrees.', answer: 'boils' },
    ],
  };

  it('shows the text around each blank and a shuffled word bank', () => {
    const view = fillBlanksMode.prepare(sentences, 3);
    expect(view.sentences).toContainEqual({ before: 'The Sun is a ', after: '.' });
    expect([...view.wordBank].sort()).toEqual(['Mars', 'boils', 'star']);
  });

  it('accepts a typed answer in any case', () => {
    const solved = fillBlanksMode.solve(sentences, 3) as string[];
    expect(
      fillBlanksMode.score(
        sentences,
        3,
        solved.map((a) => ` ${a.toUpperCase()} `),
      ).score,
    ).toBe(3);
  });
});

describe('flashcards, matching and memory', () => {
  it('flashcards count the cards the student knew', () => {
    expect(flashcardsMode.score(pairs, 1, [true, false, true]).score).toBe(2);
    expect(flashcardsMode.prepare(pairs, 1).cards).toHaveLength(5);
  });

  it('matching scores each term’s chosen definition', () => {
    const view = matchingMode.prepare(pairs, 6);
    const answers = view.terms.map((term) =>
      view.definitions.indexOf(pairs.items.find((p) => p.term === term)?.definition ?? ''),
    );
    expect(matchingMode.score(pairs, 6, answers).score).toBe(5);
  });

  it('memory has a term card and a definition card per pair', () => {
    const view = memoryMode.prepare(pairs, 2);
    expect(view.cards).toHaveLength(10);
    expect(view.cards.filter((c) => c.side === 'term')).toHaveLength(5);
  });

  it('memory counts each pair once and ignores a card paired with itself or a mismatch', () => {
    const solved = memoryMode.solve(pairs, 2) as [number, number][];
    const [first = [0, 0], second = [0, 0]] = solved;
    expect(memoryMode.score(pairs, 2, [first, first, [first[0], first[0]]]).score).toBe(1);
    expect(memoryMode.score(pairs, 2, [[first[0], second[0]]]).score).toBe(0);
    expect(memoryMode.score(pairs, 2, [[first[0], 99]]).score).toBe(0);
  });
});

describe('word search', () => {
  const words = pairs.items.map((p) => gridLetters(p.term));

  it('places every word in the grid, findable from its start to its end', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { grid, placements } = buildWordSearch(words, seededRandom(seed));
      expect(grid.every((row) => row.length === grid.length)).toBe(true);
      words.forEach((word, index) => {
        const placement = placements[index];
        expect(placement).toBeDefined();
        if (placement)
          expect(lettersAlong(grid, placement.start, placement.end)).toBe(word.join(''));
      });
    }
  });

  it('fills the rest of the grid with the words’ own letters', () => {
    const { grid } = buildWordSearch(words, seededRandom(1));
    const letters = new Set(words.flat());
    expect(grid.flat().every((letter) => letters.has(letter))).toBe(true);
  });

  it('builds the grid once per round: the same seed gives the same grid', () => {
    expect(wordSearchMode.prepare(pairs, 8).grid).toEqual(wordSearchMode.prepare(pairs, 8).grid);
  });

  it('the total is the number of words, and a word counts once', () => {
    const solved = wordSearchMode.solve(pairs, 8) as Cell[][];
    const result = wordSearchMode.score(pairs, 8, [...solved, solved[0]]);
    expect([result.score, result.total]).toEqual([5, 5]);
  });

  it('a word can be selected backwards', () => {
    const solved = wordSearchMode.solve(pairs, 8) as Cell[][];
    const reversed = solved.map(([start, end]) => [end, start]);
    expect(wordSearchMode.score(pairs, 8, reversed).score).toBe(5);
  });

  it('matches words whatever the case the teacher typed them in', () => {
    const lower: ContentOf<'pairs'> = {
      kind: 'pairs',
      items: pairs.items.map((p) => ({ ...p, term: p.term.toLowerCase() })),
    };
    const solved = wordSearchMode.solve(lower, 3) as Cell[][];
    expect(wordSearchMode.score(lower, 3, solved).score).toBe(5);
    expect(wordSearchMode.prepare(lower, 3).words).toContain('sun');
  });

  it('a bent or out-of-grid selection finds nothing', () => {
    const grid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    expect(lettersAlong(grid, [0, 0], [1, 1])).toBe('AD');
    expect(lettersAlong(grid, [0, 0], [1, 0])).toBe('AC');
    expect(lettersAlong(grid, [0, 0], [3, 1])).toBeNull();
    expect(lettersAlong(grid, [0, 0], [0, 4])).toBeNull();
  });

  it('needs words of 2 to 12 letters, at most 15 of them', () => {
    const tooLong = {
      ...pairs,
      items: [...pairs.items, { term: 'Photosynthesis', definition: 'x' }],
    };
    expect(wordSearchMode.unsuitable(tooLong)).toEqual({
      field: 'items.5.term',
      code: 'out_of_range',
    });
    const many = {
      kind: 'pairs' as const,
      items: Array.from({ length: 16 }, (_, i) => ({
        term: `Word${'x'.repeat(i % 5)}${String(i)}`,
        definition: 'd',
      })),
    };
    expect(wordSearchMode.unsuitable(many)).toEqual({ field: 'items', code: 'too_long' });
    expect(wordSearchMode.unsuitable(pairs)).toBeNull();
  });
});

describe('crossword', () => {
  const words = pairs.items.map((p, index) => ({ index, letters: gridLetters(p.term) }));

  it('lays words out so every shared square has one letter', () => {
    for (const seed of [1, 2, 3]) {
      const squares = new Map<string, string>();
      for (const word of layoutCrossword(words, seededRandom(seed))) {
        word.letters.forEach((letter, k) => {
          const key = word.across
            ? `${String(word.row)},${String(word.col + k)}`
            : `${String(word.row + k)},${String(word.col)}`;
          expect(squares.get(key) ?? letter).toBe(letter);
          squares.set(key, letter);
        });
      }
    }
  });

  it('numbers the clues from the top left, with the definitions as clues', () => {
    const view = crosswordMode.prepare(pairs, 5);
    expect(view.clues.length).toBeGreaterThanOrEqual(4);
    expect(view.clues[0]?.number).toBe(1);
    const numbers = view.clues.map((c) => c.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(pairs.items.map((p) => p.definition)).toEqual(
      expect.arrayContaining(view.clues.map((c) => c.clue)),
    );
    for (const clue of view.clues) {
      expect(clue.row + (clue.direction === 'down' ? clue.length : 1)).toBeLessThanOrEqual(
        view.rows,
      );
      expect(clue.col + (clue.direction === 'across' ? clue.length : 1)).toBeLessThanOrEqual(
        view.cols,
      );
    }
  });

  it('accepts typed words in any case, with spaces', () => {
    const solved = crosswordMode.solve(pairs, 5) as string[];
    expect(
      crosswordMode.score(
        pairs,
        5,
        solved.map((w) => w.toLowerCase()),
      ).score,
    ).toBe(solved.length);
    expect(
      crosswordMode.score(
        pairs,
        5,
        solved.map(() => 7),
      ).score,
    ).toBe(0);
  });

  it('is unsuitable when the words cannot cross, or are too long', () => {
    const apart: ContentOf<'pairs'> = {
      kind: 'pairs',
      items: ['AB', 'CD', 'EF', 'GH'].map((term) => ({ term, definition: `Letters ${term}` })),
    };
    expect(crosswordMode.unsuitable(apart)).toEqual({ field: 'items', code: 'invalid_format' });
    const long = { ...pairs, items: [...pairs.items, { term: 'x'.repeat(16), definition: 'd' }] };
    expect(crosswordMode.unsuitable(long)).toEqual({ field: 'items.5.term', code: 'out_of_range' });
    expect(crosswordMode.unsuitable(pairs)).toBeNull();
  });
});

describe('sequence and drag and drop', () => {
  it('never shows the steps already in order', () => {
    const steps: ContentOf<'steps'> = { kind: 'steps', items: ['One', 'Two'] };
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(sequenceMode.prepare(steps, seed).steps).toEqual(['Two', 'One']);
    }
  });

  it('scores each step in its right position', () => {
    const steps: ContentOf<'steps'> = { kind: 'steps', items: ['One', 'Two', 'Three', 'Four'] };
    const view = sequenceMode.prepare(steps, 3);
    const order = steps.items.map((step) => view.steps.indexOf(step));
    expect(sequenceMode.score(steps, 3, order).score).toBe(4);
    expect(sequenceMode.score(steps, 3, [order[0]]).score).toBe(1);
  });

  it('drag and drop scores each item dropped in its group', () => {
    const groups: ContentOf<'groups'> = {
      kind: 'groups',
      items: [
        { name: 'Mammals', members: ['Cat', 'Dog'] },
        { name: 'Birds', members: ['Owl', 'Hen'] },
      ],
    };
    const view = dragDropMode.prepare(groups, 2);
    const answers = view.items.map((item) =>
      view.groups.indexOf(groups.items.find((g) => g.members.includes(item))?.name ?? ''),
    );
    expect(dragDropMode.score(groups, 2, answers).score).toBe(4);
    expect(view.items).toHaveLength(4);
  });
});
