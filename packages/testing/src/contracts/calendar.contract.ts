import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import type { CalendarFeedRepository } from '@thp/ports';
import { aCalendarFeed } from '../fixtures.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export function calendarFeedRepositoryContract(
  name: string,
  make: () => CalendarFeedRepository,
): void {
  describe(`${name} (CalendarFeedRepository)`, () => {
    it('finds a link by its token hash and by its teacher, within the school', async () => {
      const repo = make();
      const feed = aCalendarFeed({ schoolId: schoolA });
      await repo.save(feed);

      expect(await repo.findByTokenHash(feed.tokenHash)).toEqual(feed);
      expect(await repo.find(schoolA, feed.teacherId)).toEqual(feed);
      expect(await repo.find(schoolB, feed.teacherId)).toBeNull();
      expect(await repo.findByTokenHash('unknown')).toBeNull();
    });

    it('keeps one link per teacher: a new one replaces the old', async () => {
      const repo = make();
      const old = aCalendarFeed({ schoolId: schoolA, tokenHash: 'hash-old' });
      const fresh = { ...old, tokenHash: 'hash-new', createdAt: new Date('2026-09-02T00:00:00Z') };
      await repo.save(old);
      await repo.save(fresh);

      expect(await repo.findByTokenHash('hash-old')).toBeNull();
      expect(await repo.findByTokenHash('hash-new')).toEqual(fresh);
      expect(await repo.find(schoolA, old.teacherId)).toEqual(fresh);
    });

    it('deletes a link only within its school', async () => {
      const repo = make();
      const feed = aCalendarFeed({ schoolId: schoolA });
      await repo.save(feed);
      await repo.delete(schoolB, feed.teacherId);
      expect(await repo.find(schoolA, feed.teacherId)).not.toBeNull();

      await repo.delete(schoolA, 'nobody' as UserId);
      await repo.delete(schoolA, feed.teacherId);
      expect(await repo.find(schoolA, feed.teacherId)).toBeNull();
      expect(await repo.findByTokenHash(feed.tokenHash)).toBeNull();
    });
  });
}
