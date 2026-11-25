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

  it('refuses JSON of another shape, or that is not JSON at all', () => {
    expect(parseContentJson('questions', '[{"term":"Sun","definition":"Star"}]')).toBeNull();
    expect(parseContentJson('pairs', '{"kind":"pairs"}')).toBeNull();
    expect(parseContentJson('pairs', 'not json')).toBeNull();
    expect(parseContentJson('steps', JSON.stringify(Array(100).fill('x')))).toBeNull();
  });
});
