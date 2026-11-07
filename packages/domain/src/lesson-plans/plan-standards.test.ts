import { describe, expect, it } from 'vitest';
import type { LessonPlanId, SchoolId, UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createLessonPlan, type LessonPlanInput } from './lesson-plan.ts';
import { planFormats, isPlanFormat, defaultPlanFormat } from './plan-format.ts';
import { noDomainStandards, planBodyFromJson, standardDomainOf } from './plan-standards.ts';
import type { PlanWeekInput } from './weekly-plan.ts';

const plan = (week: Partial<PlanWeekInput>): LessonPlanInput => ({
  id: 'plan-1' as LessonPlanId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
  body: { kind: 'weekly', weeks: [{ weekStart: '2026-11-02', ...week }] },
});

const firstWeek = (input: LessonPlanInput) => {
  const body = valueOf(createLessonPlan(input)).body;
  return body.kind === 'weekly' ? body.weeks[0] : undefined;
};

describe('standards typed by category', () => {
  it('keeps the teacher’s own codes (e.g. Puerto Rico standards) under their category', () => {
    const week = firstWeek(
      plan({
        domainStandards: {
          reading: [' 7.R.6.1 ', '7.R.4', '7.R.6.1'],
          writing: ['7.W.6'],
          language: [],
          other: ['5.N.2.1'],
        },
      }),
    );

    expect(week?.domainStandards).toEqual({
      listening_speaking: [],
      foundational_skills: [],
      reading: ['7.R.6.1', '7.R.4'],
      writing: ['7.W.6'],
      language: [],
      other: ['5.N.2.1'],
    });
  });

  it('starts with no codes in any category', () => {
    expect(firstWeek(plan({}))?.domainStandards).toEqual(noDomainStandards);
  });

  it('refuses an unknown category, a code with spaces, a long code and too many codes', () => {
    const error = (domainStandards: Record<string, readonly string[]>) =>
      errorOf(createLessonPlan(plan({ domainStandards })));

    expect(error({ math: ['1'] })).toEqual({
      field: 'weeks.0.domainStandards',
      code: 'not_allowed',
    });
    expect(error({ reading: ['7 R 6'] })).toEqual({
      field: 'weeks.0.domainStandards.reading',
      code: 'invalid_format',
    });
    expect(error({ reading: ['x'.repeat(41)] })).toEqual({
      field: 'weeks.0.domainStandards.reading',
      code: 'too_long',
    });
    expect(error({ writing: Array.from({ length: 13 }, (_, i) => `7.W.${String(i)}`) })).toEqual({
      field: 'weeks.0.domainStandards.writing',
      code: 'out_of_range',
    });
  });

  it('still accepts only official codes in the Common Core list', () => {
    expect(errorOf(createLessonPlan(plan({ standards: ['7.R.6.1'] })))).toEqual({
      field: 'weeks.0.standards',
      code: 'not_allowed',
    });
  });
});

describe('standardDomainOf', () => {
  it('places a Common Core ELA code in its category by strand', () => {
    expect(standardDomainOf('CCSS.ELA-Literacy.SL.7.1')).toBe('listening_speaking');
    expect(standardDomainOf('CCSS.ELA-Literacy.RF.3.3')).toBe('foundational_skills');
    expect(standardDomainOf('CCSS.ELA-Literacy.RL.7.6')).toBe('reading');
    expect(standardDomainOf('CCSS.ELA-Literacy.RI.7.1')).toBe('reading');
    expect(standardDomainOf('CCSS.ELA-Literacy.RST.6-8.1')).toBe('reading');
    expect(standardDomainOf('CCSS.ELA-Literacy.W.7.1')).toBe('writing');
    expect(standardDomainOf('CCSS.ELA-Literacy.WHST.6-8.1')).toBe('writing');
    expect(standardDomainOf('CCSS.ELA-Literacy.L.7.5')).toBe('language');
  });

  it('gives no category to other codes', () => {
    expect(standardDomainOf('CCSS.Math.Content.5.NF.A.1')).toBeNull();
  });
});

describe('planBodyFromJson', () => {
  it('fills the categories of a plan saved before they existed', () => {
    const saved = valueOf(createLessonPlan(plan({}))).body;
    const old = JSON.parse(JSON.stringify(saved)) as { weeks: Record<string, unknown>[] };
    for (const week of old.weeks) delete week.domainStandards;

    expect(planBodyFromJson(old)).toEqual(saved);
  });

  it('leaves Conversational English plans as they are', () => {
    const body = { kind: 'conversational_english', lessonDate: '2026-11-03' };
    expect(planBodyFromJson(body)).toBe(body);
  });
});

describe('plan formats', () => {
  it('prints in the classic two-week format unless the school picks another', () => {
    expect(planFormats).toEqual(['classic', 'simple']);
    expect(defaultPlanFormat).toBe('classic');
    expect(isPlanFormat('simple')).toBe(true);
    expect(isPlanFormat('fancy')).toBe(false);
  });
});
