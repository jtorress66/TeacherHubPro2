import { describe, expect, it } from 'vitest';
import { seededRandom, shuffle } from './random.ts';

describe('seededRandom', () => {
  it('gives the same numbers for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives numbers in 0..1', () => {
    const next = seededRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  const items = Array.from({ length: 10 }, (_, i) => i);

  it('keeps every item and does not change the input', () => {
    const shuffled = shuffle(items, seededRandom(1));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('is reproducible for a seed and differs between seeds', () => {
    expect(shuffle(items, seededRandom(3))).toEqual(shuffle(items, seededRandom(3)));
    expect(shuffle(items, seededRandom(3))).not.toEqual(shuffle(items, seededRandom(4)));
  });
});
