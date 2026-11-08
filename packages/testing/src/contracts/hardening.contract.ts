import { describe, expect, it } from 'vitest';
import type { AuditEvent, AuditEventId, SchoolId, UserId } from '@thp/domain';
import type { AuditLog, RateLimiter } from '@thp/ports';

export function rateLimiterContract(name: string, make: () => RateLimiter): void {
  describe(`${name} (RateLimiter contract)`, () => {
    const at = new Date('2026-11-08T10:00:00Z');
    const rule = { limit: 3, windowMs: 60_000 };

    it('allows the limit and refuses the next try in the same window', async () => {
      const limiter = make();
      const tries: boolean[] = [];
      for (let i = 0; i < 4; i += 1) tries.push(await limiter.hit({ key: 'k', ...rule, at }));

      expect(tries).toEqual([true, true, true, false]);
    });

    it('counts each key on its own', async () => {
      const limiter = make();
      for (let i = 0; i < 3; i += 1) await limiter.hit({ key: 'a', ...rule, at });

      expect(await limiter.hit({ key: 'b', ...rule, at })).toBe(true);
    });

    it('starts again when the window has passed', async () => {
      const limiter = make();
      for (let i = 0; i < 4; i += 1) await limiter.hit({ key: 'k', ...rule, at });
      const later = new Date(at.getTime() + 60_000);

      expect(await limiter.hit({ key: 'k', ...rule, at: later })).toBe(true);
    });
  });
}

const anEvent = (id: string, schoolId: string, minute: number): AuditEvent => ({
  id: id as AuditEventId,
  schoolId: schoolId as SchoolId,
  actorId: 'teacher-1' as UserId,
  action: 'grades_saved',
  targetId: 'assignment-1',
  at: new Date(Date.UTC(2026, 10, 8, 10, minute)),
});

/** Uses schools `school-a` and `school-b`, which must exist. */
export function auditLogContract(name: string, make: () => AuditLog): void {
  describe(`${name} (AuditLog contract)`, () => {
    it('lists a school’s events newest first, up to the limit', async () => {
      const log = make();
      await log.record(anEvent('e1', 'school-a', 1));
      await log.record(anEvent('e2', 'school-a', 3));
      await log.record(anEvent('e3', 'school-a', 2));

      const listed = await log.listForSchool('school-a' as SchoolId, 2);

      expect(listed.map((event) => event.id)).toEqual(['e2', 'e3']);
      expect(listed[0]).toEqual(anEvent('e2', 'school-a', 3));
    });

    it('never lists another school’s events', async () => {
      const log = make();
      await log.record(anEvent('e1', 'school-b', 1));

      expect(await log.listForSchool('school-a' as SchoolId, 10)).toEqual([]);
    });
  });
}
