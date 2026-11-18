import { describe, expect, it } from 'vitest';
import type { AuditAction, AuditEvent, AuditEventId, ClassId, SchoolId, UserId } from '@thp/domain';
import type { ApprovalLogReader, AuditLog, RateLimiter, UsedTicketRepository } from '@thp/ports';

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

export function usedTicketRepositoryContract(name: string, make: () => UsedTicketRepository): void {
  describe(`${name} (UsedTicketRepository contract)`, () => {
    const expiresAt = new Date(Date.now() + 5 * 60_000);

    it('lets a ticket be used once', async () => {
      const tickets = make();

      expect(await tickets.claim('ticket-1', expiresAt)).toBe(true);
      expect(await tickets.claim('ticket-1', expiresAt)).toBe(false);
    });

    it('counts each ticket on its own', async () => {
      const tickets = make();
      await tickets.claim('ticket-2', expiresAt);

      expect(await tickets.claim('ticket-3', expiresAt)).toBe(true);
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
  review: null,
  count: null,
  classId: null,
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

const anApproval = (
  id: string,
  minute: number,
  overrides: Partial<Pick<AuditEvent, 'schoolId' | 'actorId' | 'action'>> = {},
): AuditEvent => ({
  id: id as AuditEventId,
  schoolId: 'school-a' as SchoolId,
  actorId: 'teacher-1' as UserId,
  action: 'ai_grade_approved' satisfies AuditAction,
  targetId: `target-${id}`,
  at: new Date(Date.UTC(2026, 10, 8, 10, minute)),
  review: 'kept',
  count: null,
  classId: 'class-1' as ClassId,
  ...overrides,
});

/** Uses schools `school-a` and `school-b`, which must exist. */
export function approvalLogReaderContract(
  name: string,
  make: () => AuditLog & ApprovalLogReader,
): void {
  describe(`${name} (ApprovalLogReader contract)`, () => {
    const schoolA = 'school-a' as SchoolId;

    it('lists only approvals, newest first, with what each one recorded', async () => {
      const log = make();
      await log.record(anApproval('a1', 1));
      await log.record(anEvent('other', 'school-a', 2));
      await log.record({
        ...anApproval('a2', 3, { action: 'prep_approved' }),
        review: null,
        count: 12,
      });

      const listed = await log.listApprovals(schoolA, {}, 10);

      expect(listed.map((event) => event.id)).toEqual(['a2', 'a1']);
      expect(listed[0]).toMatchObject({ action: 'prep_approved', count: 12, review: null });
      expect(listed[1]).toEqual(anApproval('a1', 1));
    });

    it('keeps to the limit', async () => {
      const log = make();
      for (let minute = 1; minute <= 3; minute += 1) {
        await log.record(anApproval(`a${String(minute)}`, minute));
      }

      expect((await log.listApprovals(schoolA, {}, 2)).map((event) => event.id)).toEqual([
        'a3',
        'a2',
      ]);
    });

    it('never lists another school’s approvals', async () => {
      const log = make();
      await log.record(anApproval('b1', 1, { schoolId: 'school-b' as SchoolId }));

      expect(await log.listApprovals(schoolA, {}, 10)).toEqual([]);
    });

    it('filters by who approved and by kind', async () => {
      const log = make();
      await log.record(anApproval('mine', 1));
      await log.record(anApproval('theirs', 2, { actorId: 'teacher-2' as UserId }));
      await log.record(anApproval('path', 3, { action: 'learning_path_assigned' }));

      const own = await log.listApprovals(schoolA, { actorId: 'teacher-1' as UserId }, 10);
      const paths = await log.listApprovals(schoolA, { actions: ['learning_path_assigned'] }, 10);

      expect(own.map((event) => event.id)).toEqual(['path', 'mine']);
      expect(paths.map((event) => event.id)).toEqual(['path']);
    });

    it('filters by time: from is inclusive, to is exclusive', async () => {
      const log = make();
      for (let minute = 1; minute <= 4; minute += 1) {
        await log.record(anApproval(`a${String(minute)}`, minute));
      }

      const listed = await log.listApprovals(
        schoolA,
        {
          from: new Date(Date.UTC(2026, 10, 8, 10, 2)),
          to: new Date(Date.UTC(2026, 10, 8, 10, 4)),
        },
        10,
      );

      expect(listed.map((event) => event.id)).toEqual(['a3', 'a2']);
    });
  });
}
