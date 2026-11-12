import { describe, expect, it } from 'vitest';
import { formatInstant } from './instant-display.ts';

describe('formatInstant', () => {
  const moment = new Date('2026-11-12T00:41:00Z');

  it('shows the date and time in the given time zone', () => {
    expect(formatInstant(moment, 'en', 'America/Puerto_Rico')).toBe('Nov 11, 2026, 8:41 PM');
    expect(formatInstant(moment, 'en', 'UTC')).toBe('Nov 12, 2026, 12:41 AM');
  });

  it('writes it the way the language does', () => {
    expect(formatInstant(moment, 'es', 'UTC')).toContain('2026');
    expect(formatInstant(moment, 'es', 'UTC')).not.toBe(formatInstant(moment, 'en', 'UTC'));
  });
});
