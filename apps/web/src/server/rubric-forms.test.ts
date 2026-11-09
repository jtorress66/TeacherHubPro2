import { describe, expect, it } from 'vitest';
import { parseRubricDraftForm, parseRubricGrid } from './rubric-forms.ts';

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe('parseRubricDraftForm', () => {
  it('reads the request, with counts as numbers and the ESL switch', () => {
    expect(
      parseRubricDraftForm(
        form([
          ['locale', 'es'],
          ['topic', ' Ensayo '],
          ['subject', 'ela'],
          ['grade', ''],
          ['title', ''],
          ['criteriaCount', '5'],
          ['levelCount', ''],
          ['instructions', 'Breve'],
          ['esl', 'on'],
        ]),
      ),
    ).toEqual({
      locale: 'es',
      input: {
        topic: 'Ensayo',
        subject: 'ela',
        grade: null,
        title: null,
        criteriaCount: 5,
        language: 'es',
        esl: true,
        instructions: 'Breve',
      },
    });
  });
});

describe('parseRubricGrid', () => {
  it('reads the editor’s levels and criteria', () => {
    const grid = {
      levels: [
        { label: 'Alto', points: 2 },
        { label: 'Bajo', points: 1 },
      ],
      criteria: [{ name: 'Orden', descriptors: ['Claro', ''] }],
    };
    expect(parseRubricGrid(JSON.stringify(grid))).toEqual(grid);
  });

  it('gives null for anything that is not a grid', () => {
    expect(parseRubricGrid('not json')).toBeNull();
    expect(parseRubricGrid(JSON.stringify({ levels: 'x', criteria: [] }))).toBeNull();
  });
});
