import { describe, expect, it } from 'vitest';
import { parseContentJson } from './game-content-schema.ts';

describe('parseContentJson', () => {
  it('reads the builder’s items for the game’s kind, including text with | or =', () => {
    const items = [{ prompt: 'Is 2 | 3 = 5?', options: ['Yes', 'No'], answer: 1 }];

    expect(parseContentJson('questions', JSON.stringify(items))).toEqual({
      kind: 'questions',
      items,
    });
    expect(parseContentJson('steps', '["Mix","Bake","Serve"]')).toEqual({
      kind: 'steps',
      items: ['Mix', 'Bake', 'Serve'],
    });
  });

  it('keeps a picture on the kinds that can show one', () => {
    const picture = { id: 'pic-1', alt: 'A map of Ponce' };
    const items = [{ statement: 'Ponce is in the south', isTrue: true, picture }];

    expect(parseContentJson('statements', JSON.stringify(items))).toEqual({
      kind: 'statements',
      items,
    });
    expect(
      parseContentJson('pairs', JSON.stringify([{ term: 'Sun', definition: 'Star', picture: {} }])),
    ).toBeNull();
  });

  it('keeps the standards a card is tagged with', () => {
    const items = [{ name: 'Birds', members: ['Owl', 'Hawk'], standards: ['5.L.1', ' 5.L.2'] }];
    expect(parseContentJson('groups', JSON.stringify(items))).toEqual({ kind: 'groups', items });
  });

  it('refuses JSON of another shape, or that is not JSON at all', () => {
    expect(parseContentJson('questions', '[{"term":"Sun","definition":"Star"}]')).toBeNull();
    expect(parseContentJson('pairs', '{"kind":"pairs"}')).toBeNull();
    expect(parseContentJson('pairs', 'not json')).toBeNull();
    expect(parseContentJson('steps', JSON.stringify(Array(100).fill('x')))).toBeNull();
  });
});
