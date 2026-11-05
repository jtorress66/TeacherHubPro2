import { describe, expect, it } from 'vitest';
import {
  createPrepRequest,
  finishBatch,
  recordDone,
  startBatch,
  type ClassId,
  type GradeCategoryId,
  type JobId,
  type PrepBatch,
  type PrepBatchId,
  type SchoolId,
  type UserId,
  type WeeklyDraft,
} from '@thp/domain';
import type { PrepBatchRepository } from '@thp/ports';
import { aWeeklyDraft } from '../fakes/ai.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher = 'teacher-1' as UserId;
const colleague = 'teacher-2' as UserId;

/** A batch for class-1 by the given teacher, started at the given time. */
export function aPrepBatch(
  id: string,
  options: { teacherId?: UserId; at?: string; classId?: ClassId } = {},
): PrepBatch {
  const request = createPrepRequest({
    classId: options.classId ?? ('class-1' as ClassId),
    prompt: 'Prep next week for fractions',
    weekStart: '2026-11-09',
    subject: 'math',
    grade: '4',
    days: 2,
    options: { presentations: true, worksheets: false, quiz: true, parentEmail: true },
    quizCategoryId: 'category-1' as GradeCategoryId,
    language: 'en',
    emailTemplate: {
      subject: 'This week',
      greeting: 'Dear families,',
      intro: 'This week we will learn:',
      quizLine: 'Quiz on Friday.',
      signOff: 'Thanks',
      dayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    },
  });
  if (!request.ok) throw new Error('invalid test request');
  return startBatch({
    id: id as PrepBatchId,
    schoolId: schoolA,
    teacherId: options.teacherId ?? teacher,
    request: request.value,
    jobId: `job-${id}` as JobId,
    createdAt: new Date(options.at ?? '2026-11-05T12:00:00Z'),
  });
}

/**
 * Shared suite for PrepBatchRepository. Fixtures use class-1, category-1, teacher-1 and teacher-2 in
 * school-a, so Postgres tests seed those parents.
 */
export function prepBatchRepositoryContract(name: string, make: () => PrepBatchRepository): void {
  describe(`${name} (PrepBatchRepository)`, () => {
    it('saves a batch and reads it back as saved, items and email included', async () => {
      const repo = make();
      const started = aPrepBatch('b1');
      await repo.save(started);
      expect(await repo.find(schoolA, teacher, started.id)).toEqual(started);

      const ready = finishBatch(
        recordDone(started, 'plan', aWeeklyDraft() as WeeklyDraft),
        new Date('2026-11-05T12:03:00Z'),
      );
      await repo.save(ready);
      expect(await repo.find(schoolA, teacher, started.id)).toEqual(ready);
    });

    it("never returns a colleague's or another school's batch", async () => {
      const repo = make();
      await repo.save(aPrepBatch('b1'));
      expect(await repo.find(schoolA, colleague, 'b1' as PrepBatchId)).toBeNull();
      expect(await repo.find(schoolB, teacher, 'b1' as PrepBatchId)).toBeNull();
    });

    it("lists the teacher's batches newest first and counts the ready ones", async () => {
      const repo = make();
      const older = aPrepBatch('b1', { at: '2026-11-01T12:00:00Z' });
      const newer = finishBatch(aPrepBatch('b2', { at: '2026-11-03T12:00:00Z' }), new Date());
      await repo.save(older);
      await repo.save(newer);
      await repo.save(aPrepBatch('b3', { teacherId: colleague }));

      expect((await repo.listForTeacher(schoolA, teacher, 10)).map((b) => b.id)).toEqual([
        'b2',
        'b1',
      ]);
      expect(await repo.listForTeacher(schoolA, teacher, 1)).toHaveLength(1);
      expect(await repo.listForTeacher(schoolB, teacher, 10)).toEqual([]);
      expect(await repo.countReady(schoolA, teacher)).toBe(1);
      expect(await repo.countReady(schoolA, colleague)).toBe(0);
    });

    it("deletes only the teacher's own batch in the school", async () => {
      const repo = make();
      await repo.save(aPrepBatch('b1'));
      expect(await repo.delete(schoolA, colleague, 'b1' as PrepBatchId)).toBe(false);
      expect(await repo.delete(schoolB, teacher, 'b1' as PrepBatchId)).toBe(false);
      expect(await repo.delete(schoolA, teacher, 'b1' as PrepBatchId)).toBe(true);
      expect(await repo.find(schoolA, teacher, 'b1' as PrepBatchId)).toBeNull();
    });
  });
}
