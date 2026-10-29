import { describe, expect, it } from 'vitest';
import {
  type ClassId,
  type LessonPlanId,
  type PlanFolderId,
  type SchoolId,
  type UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createLessonPlan } from './lesson-plan.ts';

const base = {
  id: 'plan-1' as LessonPlanId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
  weekStart: '2026-09-07',
};

describe('createLessonPlan', () => {
  it('creates an empty weekly plan', () => {
    expect(valueOf(createLessonPlan({ ...base, kind: 'weekly' }))).toEqual({
      ...base,
      kind: 'weekly',
      title: null,
      classId: null,
      folderId: null,
      days: [],
      standards: [],
    });
  });

  it('keeps days, standards, class and folder', () => {
    const plan = valueOf(
      createLessonPlan({
        ...base,
        kind: 'weekly',
        classId: 'class-1' as ClassId,
        folderId: 'folder-1' as PlanFolderId,
        days: [{ weekday: 'Mon', content: 'Fractions intro' }],
        standards: ['CCSS.MATH.CONTENT.7.NS.A.1'],
      }),
    );

    expect(plan.days).toEqual([{ weekday: 'Mon', content: 'Fractions intro' }]);
    expect(plan.standards).toEqual(['CCSS.MATH.CONTENT.7.NS.A.1']);
  });

  it('a Conversational English plan needs a title', () => {
    expect(errorOf(createLessonPlan({ ...base, kind: 'conversational_english' }))).toEqual({
      field: 'title',
      code: 'required',
    });
    expect(
      valueOf(createLessonPlan({ ...base, kind: 'conversational_english', title: ' At the café ' }))
        .title,
    ).toBe('At the café');
  });

  it('rejects a bad week start and a day listed twice', () => {
    expect(errorOf(createLessonPlan({ ...base, kind: 'weekly', weekStart: 'next week' }))).toEqual({
      field: 'weekStart',
      code: 'invalid_format',
    });
    expect(
      errorOf(
        createLessonPlan({
          ...base,
          kind: 'weekly',
          days: [
            { weekday: 'Mon', content: 'a' },
            { weekday: 'Mon', content: 'b' },
          ],
        }),
      ),
    ).toEqual({ field: 'days', code: 'duplicate' });
  });

  it('rejects an over-long title', () => {
    expect(errorOf(createLessonPlan({ ...base, kind: 'weekly', title: 'x'.repeat(201) }))).toEqual({
      field: 'title',
      code: 'too_long',
    });
  });
});
