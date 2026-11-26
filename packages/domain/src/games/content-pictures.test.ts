import { describe, expect, it } from 'vitest';
import type { GameContent } from './content.ts';
import { picturesOf, removedPictures, withPictureIds } from './content-pictures.ts';

const quiz: GameContent = {
  kind: 'questions',
  items: [
    {
      prompt: 'Where is Ponce?',
      options: ['South', 'North'],
      answer: 0,
      picture: { id: 'a', alt: 'Map' },
    },
    { prompt: 'Largest planet?', options: ['Mars', 'Jupiter'], answer: 1 },
    {
      prompt: 'Which flag?',
      options: ['Peru', 'Chile'],
      answer: 1,
      picture: { id: 'b', alt: 'Flag' },
    },
  ],
};

describe('picturesOf', () => {
  it('lists every picture in the game, in order', () => {
    expect(picturesOf(quiz)).toEqual([
      { id: 'a', alt: 'Map' },
      { id: 'b', alt: 'Flag' },
    ]);
  });

  it('finds none in kinds that have no pictures', () => {
    expect(picturesOf({ kind: 'steps', items: ['One', 'Two', 'Three'] })).toEqual([]);
  });
});

describe('withPictureIds', () => {
  it('points each picture at a new id and leaves everything else alone', () => {
    const renamed = withPictureIds(quiz, (id) => `copy-${id}`);
    expect(picturesOf(renamed).map((p) => p.id)).toEqual(['copy-a', 'copy-b']);
    expect(renamed.items[1]).toEqual(quiz.items[1]);
    expect(picturesOf(quiz).map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('removedPictures', () => {
  it('names the pictures an edit took out, so their files can go', () => {
    const edited: GameContent = { kind: 'questions', items: quiz.items.slice(1) };
    expect(removedPictures(quiz, edited)).toEqual(['a']);
    expect(removedPictures(quiz, quiz)).toEqual([]);
  });
});
