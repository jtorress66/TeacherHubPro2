import { describe, expect, it } from 'vitest';
import { formatRate, rateBand } from './attendance-display.ts';

describe('attendance rate display', () => {
  it('bands a rate: 90 and up is good, 80 and up needs watching, below is low', () => {
    expect(rateBand(100)).toBe('good');
    expect(rateBand(90)).toBe('good');
    expect(rateBand(89.9)).toBe('warning');
    expect(rateBand(80)).toBe('warning');
    expect(rateBand(79.9)).toBe('low');
    expect(rateBand(0)).toBe('low');
    expect(rateBand(null)).toBe('none');
  });

  it('formats a rate with at most one decimal in the page language', () => {
    expect(formatRate(83.333, 'en')).toBe('83.3%');
    expect(formatRate(83.333, 'es')).toMatch(/^83,3\s?%$/);
    expect(formatRate(100, 'en')).toBe('100%');
    expect(formatRate(null, 'en')).toBe('—');
  });
});
