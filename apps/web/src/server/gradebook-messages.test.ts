import { describe, expect, it } from 'vitest';
import { gradeEntryMessages, gradeFieldMessages } from './gradebook-messages.ts';

describe('gradebook messages', () => {
  it('puts each refused grade under its score field, with a summary for the form', () => {
    expect(
      gradeEntryMessages(
        { code: 'invalid_grades', rows: { s1: 'out_of_range', s2: 'not_allowed' } },
        'en',
      ),
    ).toEqual({
      form: 'Check the highlighted grades (2).',
      'score.s1':
        'Enter a score from 0 to the assignment points for graded or late work, and none otherwise.',
      'score.s2': 'This student is not in the class. Reload the page.',
    });
  });

  it('uses the shared messages for other refusals, in Spanish too', () => {
    expect(gradeEntryMessages({ code: 'class_archived' }, 'es')).toEqual({
      form: 'Esta clase está archivada. Restáurala primero.',
    });
    expect(gradeEntryMessages({ field: 'categoryId', code: 'not_allowed' }, 'es')).toEqual({
      categoryId: 'Elige una de las categorías de esta clase.',
    });
    expect(gradeEntryMessages({ field: 'comment', code: 'too_long' }, 'en')).toEqual({
      comment: 'Comments can be up to 1,000 characters.',
    });
    expect(gradeEntryMessages({ field: 'points', code: 'out_of_range' }, 'en')).toEqual({
      points: 'This value is out of range.',
    });
  });

  it('turns the form’s own field errors into messages', () => {
    expect(
      gradeFieldMessages({ 'score.s1': 'invalid_format', 'comment.s2': 'too_long' }, 'en'),
    ).toEqual({
      form: 'Check the highlighted grades (2).',
      'score.s1': 'Please check this value.',
      'comment.s2': 'This is too long.',
    });
  });
});
