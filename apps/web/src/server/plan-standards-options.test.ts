import { describe, expect, it } from 'vitest';
import { prOptionsFor } from './plan-standards-options.ts';

describe('prOptionsFor', () => {
  it('gives each Puerto Rico subject its grades and levels, and each class the grade the list starts on', () => {
    const options = prOptionsFor([
      { id: 'class-7', grade: '7' },
      { id: 'class-k', grade: 'Kínder' },
      { id: 'class-none', grade: null },
    ]);

    expect(options.choices.english).toContain('7');
    expect(options.choices.science).toEqual([
      'K',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      'intermediate',
      'high',
    ]);
    expect(options.classGrades).toEqual({ 'class-7': '7', 'class-k': 'K' });
  });
});
