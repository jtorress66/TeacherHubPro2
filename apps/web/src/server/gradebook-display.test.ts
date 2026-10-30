import { describe, expect, it } from 'vitest';
import { formatGpa, formatPercent, formatPoints, letterBand } from './gradebook-display.ts';

describe('gradebook display', () => {
  it('formats percentages with one decimal in the page language, and a dash for none', () => {
    expect(formatPercent(86.25, 'en')).toBe('86.3%');
    expect(formatPercent(80, 'es')).toMatch(/^80\s?%$/);
    expect(formatPercent(null, 'en')).toBe('—');
  });

  it('formats a GPA with two decimals', () => {
    expect(formatPercent(100, 'en')).toBe('100%');
    expect(formatGpa(3.625, 'en')).toBe('3.63');
    expect(formatGpa(3, 'es')).toBe('3,00');
    expect(formatGpa(null, 'en')).toBe('—');
  });

  it('formats points with up to two decimals', () => {
    expect(formatPoints(45, 'en')).toBe('45');
    expect(formatPoints(8.5, 'es')).toBe('8,5');
  });

  it('gives each letter its own colour band, with none for no grade', () => {
    expect(['A', 'B', 'C', 'D', 'F', null].map((l) => letterBand(l as never))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'f',
      'none',
    ]);
  });
});
