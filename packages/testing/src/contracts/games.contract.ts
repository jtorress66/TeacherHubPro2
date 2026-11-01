import { describe, expect, it } from 'vitest';
import type { GameId, GamePlayId, SchoolId } from '@thp/domain';
import type { GamePlayRepository, SeedSource } from '@thp/ports';
import { aGamePlay } from '../fixtures.ts';
import { scopedRepositoryContract } from './scoped-repository.contract.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export function seedSourceContract(name: string, make: () => SeedSource): void {
  describe(`${name} (SeedSource contract)`, () => {
    it('gives whole numbers in [0, 2^31) that change between calls', () => {
      const source = make();
      const seeds = Array.from({ length: 50 }, () => source.next());
      for (const seed of seeds) {
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(2 ** 31);
      }
      expect(new Set(seeds).size).toBeGreaterThan(45);
    });
  });
}

/**
 * Shared suite for game plays. Fixtures use game-1, class-1 and student-1 in school-a, so
 * Postgres tests seed those parents.
 */
export function gamePlayRepositoryContract(name: string, make: () => GamePlayRepository): void {
  scopedRepositoryContract(`${name} game plays`, {
    make,
    sample: (schoolId, id) => aGamePlay({ schoolId, id: id as GamePlayId }),
    change: (play) => ({ ...play, score: 1 }),
    lists: [
      {
        name: 'listByGame',
        call: (repo, schoolId, play) => repo.listByGame(schoolId, play.gameId),
      },
    ],
  });

  describe(`${name} (GamePlayRepository)`, () => {
    it('lists a game’s plays oldest first, only for that game', async () => {
      const repo = make();
      const later = aGamePlay({
        schoolId: schoolA,
        id: 'p2' as GamePlayId,
        playedAt: new Date('2026-11-01T11:00:00Z'),
      });
      const earlier = aGamePlay({
        schoolId: schoolA,
        id: 'p1' as GamePlayId,
        playedAt: new Date('2026-11-01T10:00:00Z'),
      });
      await repo.save(later);
      await repo.save(earlier);

      expect(await repo.listByGame(schoolA, later.gameId)).toEqual([earlier, later]);
      expect(await repo.listByGame(schoolA, 'game-9' as GameId)).toEqual([]);
    });

    it('deletes a game’s plays, within the school only', async () => {
      const repo = make();
      const play = aGamePlay({ schoolId: schoolA });
      await repo.save(play);

      await repo.deleteByGame(schoolB, play.gameId);
      expect(await repo.listByGame(schoolA, play.gameId)).toHaveLength(1);
      await repo.deleteByGame(schoolA, play.gameId);
      expect(await repo.listByGame(schoolA, play.gameId)).toEqual([]);
    });
  });
}
