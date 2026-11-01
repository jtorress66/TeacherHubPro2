import type { GameContent, GameMode } from '@thp/domain';
import { describe, expect, it } from 'vitest';

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const malformed: readonly unknown[] = [null, 'x', 42, {}, [null], [[1]], [{}], [[-1, 99]], [[[0]]]];

const itemCount = (content: GameContent): number =>
  content.kind === 'groups'
    ? content.items.reduce((sum, group) => sum + group.members.length, 0)
    : content.items.length;

/** Every game mode must pass this suite (Liskov): any mode can stand in for another. */
export function gameModeContract(name: string, mode: GameMode, content: GameContent): void {
  describe(`${name} game mode contract`, () => {
    it('plays and suits its sample content', () => {
      expect(mode.plays(content.kind)).toBe(true);
      expect(mode.unsuitable(content)).toBeNull();
    });

    it('rebuilds the same round from the same seed', () => {
      expect(mode.prepare(content, 11)).toEqual(mode.prepare(content, 11));
      expect(mode.solve(content, 11)).toEqual(mode.solve(content, 11));
    });

    it('reshuffles the round with a different seed', () => {
      const views = new Set(seeds.map((seed) => JSON.stringify(mode.prepare(content, seed))));
      expect(views.size).toBeGreaterThan(1);
    });

    it('perfect answers score full marks', () => {
      for (const seed of seeds) {
        const result = mode.score(content, seed, mode.solve(content, seed));
        expect(result.total).toBeGreaterThan(0);
        expect(result.score).toBe(result.total);
        expect(result.results).toHaveLength(result.total);
        expect(result.results.every(Boolean)).toBe(true);
      }
    });

    it('no answers score zero', () => {
      for (const answers of [undefined, []]) {
        const result = mode.score(content, 3, answers);
        expect(result.score).toBe(0);
        expect(result.total).toBe(mode.score(content, 3, mode.solve(content, 3)).total);
      }
    });

    it('scores no more items than the content holds', () => {
      expect(mode.score(content, 4, mode.solve(content, 4)).total).toBeLessThanOrEqual(
        itemCount(content),
      );
    });

    it('never throws on malformed answers, and never scores them above the total', () => {
      for (const answers of malformed) {
        const result = mode.score(content, 5, answers);
        expect(result.score).toBeLessThanOrEqual(result.total);
        expect(result.score).toBeGreaterThanOrEqual(0);
      }
    });

    it('the view does not reveal the answers', () => {
      const view = JSON.stringify(mode.prepare(content, 6));
      expect(view).not.toMatch(/"(answer|answers|key|correct|isTrue)"/);
    });
  });
}
