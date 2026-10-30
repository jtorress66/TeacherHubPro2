import { describe, expect, it } from 'vitest';
import type { ClassId, LessonPlanId, SchoolId, UserId } from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { createLessonPlan, type LessonPlan } from '../lesson-plans/lesson-plan.ts';
import {
  createSubPacket,
  planOnDate,
  seatingRows,
  weekOnDate,
  type SubPacketInput,
} from './sub-packet.ts';

const input = (overrides: Partial<SubPacketInput> = {}): SubPacketInput => ({
  classId: 'class-1' as ClassId,
  schoolId: 'school-1' as SchoolId,
  ...overrides,
});

describe('createSubPacket', () => {
  it('starts from the usual extensions with accommodations included', () => {
    expect(createSubPacket(input())).toEqual({
      ok: true,
      value: {
        classId: 'class-1',
        schoolId: 'school-1',
        mainOfficeExt: null,
        nurseExt: null,
        dailyRoutines: null,
        emergencyProcedures: null,
        additionalNotes: null,
        includeAccommodations: true,
      },
    });
  });

  it('keeps trimmed notes and the accommodations choice', () => {
    const packet = createSubPacket(
      input({
        mainOfficeExt: ' Ext. 100 ',
        dailyRoutines: 'Line up at 8:00',
        includeAccommodations: false,
      }),
    );
    expect(packet.ok && packet.value).toMatchObject({
      mainOfficeExt: 'Ext. 100',
      dailyRoutines: 'Line up at 8:00',
      includeAccommodations: false,
    });
  });

  it.each([
    [{ nurseExt: 'x'.repeat(41) }, 'nurseExt'],
    [{ emergencyProcedures: 'x'.repeat(5001) }, 'emergencyProcedures'],
  ])('rejects over-long %o', (overrides, field) => {
    expect(createSubPacket(input(overrides))).toEqual({
      ok: false,
      error: { field, code: 'too_long' },
    });
  });
});

describe('seatingRows', () => {
  it('fills rows of five in roster order', () => {
    const names = Array.from({ length: 12 }, (_, i) => `s${String(i + 1)}`);
    expect(seatingRows(names, 5)).toEqual([
      ['s1', 's2', 's3', 's4', 's5'],
      ['s6', 's7', 's8', 's9', 's10'],
      ['s11', 's12'],
    ]);
    expect(seatingRows([], 5)).toEqual([]);
  });
});

describe('planOnDate', () => {
  const plan = (id: string, weekStart: string, classId = 'class-1'): LessonPlan => {
    const created = createLessonPlan({
      id: id as LessonPlanId,
      schoolId: 'school-1' as SchoolId,
      teacherId: 'teacher-1' as UserId,
      classId: classId as ClassId,
      body: { kind: 'weekly', weeks: [{ weekStart }] },
    });
    if (!created.ok) throw new Error(created.error.field);
    return created.value;
  };

  it('picks the weekly plan whose week covers the date', () => {
    const plans = [
      plan('old', '2026-10-19'),
      plan('this', '2026-10-26'),
      plan('next', '2026-11-02'),
    ];
    expect(planOnDate(plans, '2026-10-29' as LocalDate)?.id).toBe('this');
    expect(planOnDate(plans, '2026-10-30' as LocalDate)?.id).toBe('this');
    expect(planOnDate(plans, '2026-10-31' as LocalDate)).toBeNull();
    expect(planOnDate(plans, '2026-11-15' as LocalDate)).toBeNull();
  });

  it('ignores Conversational English plans', () => {
    const lesson = createLessonPlan({
      id: 'ce' as LessonPlanId,
      schoolId: 'school-1' as SchoolId,
      teacherId: 'teacher-1' as UserId,
      title: 'At the restaurant',
      body: { kind: 'conversational_english', lessonDate: '2026-10-29' },
    });
    if (!lesson.ok) throw new Error('bad');
    expect(planOnDate([lesson.value], '2026-10-29' as LocalDate)).toBeNull();
  });

  it('prefers the plan that started latest when two cover the date', () => {
    const twoWeeks = createLessonPlan({
      id: 'long' as LessonPlanId,
      schoolId: 'school-1' as SchoolId,
      teacherId: 'teacher-1' as UserId,
      body: { kind: 'weekly', weeks: [{ weekStart: '2026-10-19' }, { weekStart: '2026-10-26' }] },
    });
    if (!twoWeeks.ok) throw new Error('bad');
    const plans = [twoWeeks.value, plan('this', '2026-10-26')];
    expect(planOnDate(plans, '2026-10-28' as LocalDate)?.id).toBe('this');
  });
});

describe('weekOnDate', () => {
  it('finds the week of a two-week plan that covers the date', () => {
    const plan = createLessonPlan({
      id: 'two' as LessonPlanId,
      schoolId: 'school-1' as SchoolId,
      teacherId: 'teacher-1' as UserId,
      body: {
        kind: 'weekly',
        weeks: [
          { weekStart: '2026-10-19', objective: 'First' },
          { weekStart: '2026-10-26', objective: 'Second' },
        ],
      },
    });
    if (!plan.ok) throw new Error('bad');
    expect(weekOnDate(plan.value, '2026-10-21' as LocalDate)?.objective).toBe('First');
    expect(weekOnDate(plan.value, '2026-10-30' as LocalDate)?.objective).toBe('Second');
    expect(weekOnDate(plan.value, '2026-10-25' as LocalDate)).toBeNull();
  });
});
