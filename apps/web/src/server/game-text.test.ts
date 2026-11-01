import { describe, expect, it } from 'vitest';
import { contentKinds, validateContent } from '@thp/domain';
import { sampleGameContent } from '@thp/testing';
import { contentText, parseContentText } from './game-text.ts';

describe('game content as text', () => {
  it('reads one item per line for each kind, ignoring blank lines', () => {
    expect(
      parseContentText(
        'questions',
        'Largest planet? | Mars | *Jupiter | Venus\n\n  Closest to the Sun?|*Mercury|Earth  ',
      ),
    ).toEqual({
      kind: 'questions',
      items: [
        { prompt: 'Largest planet?', options: ['Mars', 'Jupiter', 'Venus'], answer: 1 },
        { prompt: 'Closest to the Sun?', options: ['Mercury', 'Earth'], answer: 0 },
      ],
    });
    expect(
      parseContentText('statements', 'The Sun is a star | true\nLa Luna es un planeta | falso'),
    ).toEqual({
      kind: 'statements',
      items: [
        { statement: 'The Sun is a star', isTrue: true },
        { statement: 'La Luna es un planeta', isTrue: false },
      ],
    });
    expect(parseContentText('sentences', 'The Sun is a ___. | star')).toEqual({
      kind: 'sentences',
      items: [{ text: 'The Sun is a ___.', answer: 'star' }],
    });
    expect(parseContentText('pairs', 'Sun = Our star = the closest one\nMoon=Satellite')).toEqual({
      kind: 'pairs',
      items: [
        { term: 'Sun', definition: 'Our star = the closest one' },
        { term: 'Moon', definition: 'Satellite' },
      ],
    });
    expect(parseContentText('steps', 'Mix\nBake')).toEqual({
      kind: 'steps',
      items: ['Mix', 'Bake'],
    });
    expect(parseContentText('groups', 'Mammals: cat, dog\nBirds: owl,hen,')).toEqual({
      kind: 'groups',
      items: [
        { name: 'Mammals', members: ['cat', 'dog'] },
        { name: 'Birds', members: ['owl', 'hen'] },
      ],
    });
  });

  it('accepts true and false in the supported languages', () => {
    const truths = parseContentText(
      'statements',
      ['a | sí', 'b | vrai', 'c | wahr', 'd | 对', 'e | no'].join('\n'),
    );
    expect(truths.items.map((item) => (item as { isTrue: boolean }).isTrue)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('leaves a missing right option or definition for the checks to report', () => {
    const noAnswer = parseContentText('questions', 'Largest? | Mars | Venus');
    expect(noAnswer.items[0]).toMatchObject({ answer: -1 });
    expect(validateContent(noAnswer).ok).toBe(false);
    expect(parseContentText('pairs', 'Sun').items[0]).toEqual({ term: 'Sun', definition: '' });
    expect(parseContentText('groups', 'Mammals').items[0]).toEqual({
      name: 'Mammals',
      members: [],
    });
  });

  it('writes content back as the same text, for every kind', () => {
    for (const kind of contentKinds) {
      const content = sampleGameContent[kind];
      expect(parseContentText(kind, contentText(content))).toEqual(content);
    }
    expect(contentText(sampleGameContent.questions).split('\n')[0]).toBe(
      'Which is the largest planet? | Mars | *Jupiter | Venus',
    );
  });
});
