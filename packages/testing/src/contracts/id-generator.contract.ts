import { describe, expect, it } from 'vitest';
import type { IdGenerator } from '@thp/ports';

/** Shared suite every IdGenerator implementation must pass. */
export function idGeneratorContract(name: string, makeGenerator: () => IdGenerator): void {
  describe(`${name} (IdGenerator contract)`, () => {
    it('returns a non-empty string id', () => {
      const id = makeGenerator().next();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique ids', () => {
      const generator = makeGenerator();
      const ids = Array.from({ length: 1000 }, () => generator.next());

      expect(new Set(ids).size).toBe(ids.length);
    });
  });
}
