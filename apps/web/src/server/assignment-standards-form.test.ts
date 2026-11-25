import { describe, expect, it } from 'vitest';
import { nextStandards, standardsProblem } from './assignment-standards-form.ts';

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

describe('nextStandards', () => {
  it('adds the typed codes, split by commas or spaces, after the ones already there', () => {
    const data = form([
      ['standards', '4.N.1.1'],
      ['add', ' 4.N.1.2, CCSS.Math.Content.4.NF.A.1  4.N.1.1 '],
    ]);

    expect(nextStandards(data)).toEqual([
      '4.N.1.1',
      '4.N.1.2',
      'CCSS.Math.Content.4.NF.A.1',
      '4.N.1.1',
    ]);
  });

  it('leaves out the code the teacher removed', () => {
    const data = form([
      ['standards', '4.N.1.1'],
      ['standards', '4.N.1.2'],
      ['remove', '4.N.1.1'],
    ]);

    expect(nextStandards(data)).toEqual(['4.N.1.2']);
  });
});

describe('standardsProblem', () => {
  it('names the rule a refused list broke, or none', () => {
    expect(standardsProblem('too_long')).toBe('tooLong');
    expect(standardsProblem('out_of_range')).toBe('tooMany');
    expect(standardsProblem('whatever')).toBeNull();
    expect(standardsProblem(undefined)).toBeNull();
  });
});
