import { describe, expect, it } from 'vitest';
import { aiUsageSince, aiUsageWindowDays, heavyAiUseThreshold, isHeavyAiUse } from './ai-usage.ts';

describe('AI use', () => {
  it('looks back 30 days', () => {
    expect(aiUsageWindowDays).toBe(30);
    expect(aiUsageSince(new Date('2026-11-11T12:00:00Z'))).toEqual(
      new Date('2026-10-12T12:00:00Z'),
    );
  });

  it('flags an account with 150 or more AI drafts in that time', () => {
    expect(heavyAiUseThreshold).toBe(150);
    expect(isHeavyAiUse(149)).toBe(false);
    expect(isHeavyAiUse(150)).toBe(true);
    expect(isHeavyAiUse(0)).toBe(false);
  });
});
