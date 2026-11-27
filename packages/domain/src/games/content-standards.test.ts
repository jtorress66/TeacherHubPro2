import { describe, expect, it } from 'vitest';
import { seededRandom } from './random.ts';
import { convertContent } from './conversions.ts';
import { standardsOf } from './content-standards.ts';

describe('standardsOf', () => {
  it('lists every standard the game’s items practise, once each, in order', () => {
    expect(
      standardsOf({
        kind: 'statements',
        items: [
          { statement: 'Ponce is in the south', isTrue: true, standards: ['6.G.1'] },
          { statement: 'The Moon is a planet', isTrue: false, standards: ['6.E.2', '6.G.1'] },
          { statement: 'Mars is red', isTrue: true },
        ],
      }),
    ).toEqual(['6.G.1', '6.E.2']);
  });

  it('finds none in a game of steps, which have no tags', () => {
    expect(standardsOf({ kind: 'steps', items: ['Mix', 'Bake', 'Serve'] })).toEqual([]);
  });

  it('keeps a pair’s standards when it becomes a quiz question', () => {
    const quiz = convertContent(
      {
        kind: 'pairs',
        items: [
          { term: 'Sun', definition: 'Our star', standards: ['5.E.1'] },
          { term: 'Moon', definition: 'Earth’s satellite' },
          { term: 'Comet', definition: 'Icy body' },
          { term: 'Orbit', definition: 'Path around a body' },
        ],
      },
      'questions',
      seededRandom(1),
    );
    expect(quiz === null ? [] : standardsOf(quiz)).toEqual(['5.E.1']);
  });
});
