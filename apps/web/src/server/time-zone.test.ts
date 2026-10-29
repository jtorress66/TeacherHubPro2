import { describe, expect, it } from 'vitest';
import { timeZoneFrom } from './time-zone.ts';

describe('timeZoneFrom', () => {
  it('keeps a real time zone from the browser', () => {
    expect(timeZoneFrom('America/Puerto_Rico')).toBe('America/Puerto_Rico');
  });

  it('falls back to UTC when it is missing or not a time zone', () => {
    expect(timeZoneFrom(undefined)).toBe('UTC');
    expect(timeZoneFrom('')).toBe('UTC');
    expect(timeZoneFrom('Mars/Olympus')).toBe('UTC');
  });
});
