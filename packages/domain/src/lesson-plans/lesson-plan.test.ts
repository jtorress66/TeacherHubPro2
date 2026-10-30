import { describe, expect, it } from 'vitest';
import type { ClassId, LessonPlanId, PlanFolderId, SchoolId, UserId } from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { errorOf, valueOf } from '../test-support.ts';
import type { ConversationalBodyInput } from './conversational-plan.ts';
import {
  createLessonPlan,
  duplicateLessonPlan,
  planKind,
  planSpan,
  updateLessonPlan,
  type LessonPlanInput,
} from './lesson-plan.ts';
import type { PlanDayInput, WeeklyBodyInput } from './weekly-plan.ts';

const ids = {
  id: 'plan-1' as LessonPlanId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
};
const weekly = (body: Partial<WeeklyBodyInput> = {}): LessonPlanInput => ({
  ...ids,
  body: { kind: 'weekly', weeks: [{ weekStart: '2026-09-07' }], ...body },
});
const conversational = (
  body: Partial<ConversationalBodyInput> = {},
  title: string | null = 'Ordering food',
): LessonPlanInput => ({
  ...ids,
  title,
  body: { kind: 'conversational_english', lessonDate: '2026-09-08', ...body },
});
const withDay = (day: PlanDayInput) =>
  weekly({ weeks: [{ weekStart: '2026-09-07', days: [day, {}, {}, {}, {}] }] });

describe('weekly lesson plans', () => {
  it('starts with five blank days and no title', () => {
    const plan = valueOf(createLessonPlan(weekly()));

    expect(plan).toMatchObject({ ...ids, title: null, classId: null, folderId: null });
    expect(planKind(plan)).toBe('weekly');
    expect(plan.body).toMatchObject({ unit: null, story: null, subjectIntegration: [] });
    const [week] = plan.body.kind === 'weekly' ? plan.body.weeks : [];
    expect(week?.days).toHaveLength(5);
    expect(week?.days[0]).toEqual({
      theme: null,
      dok: [],
      eca: [],
      activities: [],
      materials: [],
      notes: null,
    });
  });

  it('keeps the class, folder, header and a full day', () => {
    const plan = valueOf(
      createLessonPlan({
        ...weekly({
          unit: ' Fractions ',
          story: 'Pizza party',
          teacherName: 'Ms. Rivera',
          subjectIntegration: ['science', 'art'],
          weeks: [
            {
              weekStart: '2026-09-07',
              objective: 'Compare fractions',
              skills: ['Equivalence', ' ', 'Number lines'],
              standards: ['CCSS.Math.Content.4.NF.A.1', 'CCSS.Math.Content.4.NF.A.1'],
              expectations: 'Explain why 1/2 = 2/4',
              days: [
                {
                  theme: 'Hook',
                  dok: [2, 1],
                  eca: ['core'],
                  activities: [
                    { type: 'vocabulary', notes: 'numerator' },
                    { type: 'brainstorming' },
                  ],
                  materials: ['notebook', 'book'],
                  notes: '| a | b |\n|---|---|',
                },
                {},
                {},
                {},
                {},
              ],
            },
          ],
        }),
        title: 'Week of fractions',
        classId: 'class-1' as ClassId,
        folderId: 'folder-1' as PlanFolderId,
      }),
    );

    expect(plan).toMatchObject({
      title: 'Week of fractions',
      classId: 'class-1',
      folderId: 'folder-1',
    });
    expect(plan.body).toMatchObject({
      unit: 'Fractions',
      teacherName: 'Ms. Rivera',
      subjectIntegration: ['science', 'art'],
    });
    if (plan.body.kind !== 'weekly') throw new Error('expected a weekly plan');
    const [week] = plan.body.weeks;
    expect(week?.skills).toEqual(['Equivalence', 'Number lines']);
    expect(week?.standards).toEqual(['CCSS.Math.Content.4.NF.A.1']);
    expect(week?.days[0]).toEqual({
      theme: 'Hook',
      dok: [1, 2],
      eca: ['core'],
      activities: [
        { type: 'brainstorming', notes: null },
        { type: 'vocabulary', notes: 'numerator' },
      ],
      materials: ['book', 'notebook'],
      notes: '| a | b |\n|---|---|',
    });
  });

  it('may hold a second week, which must start later', () => {
    const plan = valueOf(
      createLessonPlan(
        weekly({ weeks: [{ weekStart: '2026-09-07' }, { weekStart: '2026-09-14' }] }),
      ),
    );
    expect(planSpan(plan.body)).toEqual({ start: '2026-09-07', end: '2026-09-18' });

    expect(
      errorOf(
        createLessonPlan(
          weekly({ weeks: [{ weekStart: '2026-09-14' }, { weekStart: '2026-09-07' }] }),
        ),
      ),
    ).toEqual({ field: 'weeks.1.weekStart', code: 'invalid_order' });
    expect(
      errorOf(
        createLessonPlan(
          weekly({ weeks: [{ weekStart: '2026-09-07' }, { weekStart: '2026-09-07' }] }),
        ),
      ),
    ).toEqual({ field: 'weeks.1.weekStart', code: 'invalid_order' });
  });

  it.each([
    [weekly({ weeks: [] }), 'weeks', 'out_of_range'],
    [
      weekly({
        weeks: ['2026-09-07', '2026-09-14', '2026-09-21'].map((weekStart) => ({ weekStart })),
      }),
      'weeks',
      'out_of_range',
    ],
    [weekly({ weeks: [{ weekStart: '2026-09-08' }] }), 'weeks.0.weekStart', 'not_allowed'],
    [weekly({ weeks: [{ weekStart: '07/09/2026' }] }), 'weeks.0.weekStart', 'invalid_format'],
    [
      weekly({ weeks: [{ weekStart: '2026-09-07', skills: ['a', 'b', 'c', 'd', 'e'] }] }),
      'weeks.0.skills',
      'out_of_range',
    ],
    [
      weekly({ weeks: [{ weekStart: '2026-09-07', skills: ['x'.repeat(201)] }] }),
      'weeks.0.skills',
      'too_long',
    ],
    [
      weekly({ weeks: [{ weekStart: '2026-09-07', standards: ['CCSS.Math.Content.4.NF.Z.9'] }] }),
      'weeks.0.standards',
      'not_allowed',
    ],
    [
      weekly({ weeks: [{ weekStart: '2026-09-07', objective: 'x'.repeat(5001) }] }),
      'weeks.0.objective',
      'too_long',
    ],
    [
      weekly({ weeks: [{ weekStart: '2026-09-07', expectations: 'x'.repeat(5001) }] }),
      'weeks.0.expectations',
      'too_long',
    ],
    [
      weekly({ weeks: [{ weekStart: '2026-09-07', days: [{}, {}, {}, {}, {}, {}] }] }),
      'weeks.0.days',
      'out_of_range',
    ],
    [withDay({ theme: 'x'.repeat(201) }), 'weeks.0.days.0.theme', 'too_long'],
    [withDay({ dok: [5] }), 'weeks.0.days.0.dok', 'invalid_format'],
    [withDay({ eca: ['extra'] }), 'weeks.0.days.0.eca', 'invalid_format'],
    [withDay({ activities: [{ type: 'dancing' }] }), 'weeks.0.days.0.activities', 'invalid_format'],
    [
      withDay({ activities: [{ type: 'other' }, { type: 'other' }] }),
      'weeks.0.days.0.activities',
      'duplicate',
    ],
    [
      withDay({ activities: [{ type: 'other', notes: 'x'.repeat(5001) }] }),
      'weeks.0.days.0.activities',
      'too_long',
    ],
    [withDay({ materials: ['laptop'] }), 'weeks.0.days.0.materials', 'invalid_format'],
    [withDay({ notes: 'x'.repeat(5001) }), 'weeks.0.days.0.notes', 'too_long'],
    [weekly({ unit: 'x'.repeat(201) }), 'unit', 'too_long'],
    [weekly({ story: 'x'.repeat(201) }), 'story', 'too_long'],
    [weekly({ teacherName: 'x'.repeat(201) }), 'teacherName', 'too_long'],
    [weekly({ subjectIntegration: ['cooking'] }), 'subjectIntegration', 'invalid_format'],
    [{ ...weekly(), title: 'x'.repeat(201) }, 'title', 'too_long'],
  ])('refuses invalid input (%#: %s %s)', (input, field, code) => {
    expect(errorOf(createLessonPlan(input))).toEqual({ field, code });
  });
});

describe('Conversational English plans', () => {
  it('need a title', () => {
    expect(errorOf(createLessonPlan(conversational({}, '  ')))).toEqual({
      field: 'title',
      code: 'required',
    });
  });

  it('keep their sections and dates', () => {
    const plan = valueOf(
      createLessonPlan(
        conversational({
          subject: 'Conversational English',
          lessonDateEnd: '2026-09-10',
          topic: 'At the restaurant',
          learningObjectives: 'Order a meal politely',
          materials: 'Menus',
          hook: 'Guess the dish',
          learningGoal: 'I can order food',
          closure: 'Role play',
          testQuizDate: '2026-09-11',
          notes: 'Fill in: I would like ___',
        }),
      ),
    );

    expect(plan.title).toBe('Ordering food');
    expect(plan.body).toMatchObject({
      kind: 'conversational_english',
      lessonDate: '2026-09-08',
      lessonDateEnd: '2026-09-10',
      hook: 'Guess the dish',
      testQuizDate: '2026-09-11',
    });
    expect(planSpan(plan.body)).toEqual({ start: '2026-09-08', end: '2026-09-10' });
  });

  it('cover a single day when there is no end date', () => {
    const plan = valueOf(createLessonPlan(conversational()));
    expect(plan.body).toMatchObject({ lessonDateEnd: null, testQuizDate: null, notes: null });
    expect(planSpan(plan.body)).toEqual({ start: '2026-09-08', end: '2026-09-08' });
  });

  it.each([
    [conversational({ lessonDate: 'soon' }), 'lessonDate', 'invalid_format'],
    [conversational({ lessonDateEnd: '2026-09-07' }), 'lessonDateEnd', 'invalid_order'],
    [conversational({ lessonDateEnd: '2026-02-30' }), 'lessonDateEnd', 'invalid_format'],
    [conversational({ testQuizDate: 'tomorrow' }), 'testQuizDate', 'invalid_format'],
    [conversational({ subject: 'x'.repeat(201) }), 'subject', 'too_long'],
    [conversational({ topic: 'x'.repeat(201) }), 'topic', 'too_long'],
    [conversational({ closure: 'x'.repeat(5001) }), 'closure', 'too_long'],
  ])('refuses invalid input (%#: %s %s)', (input, field, code) => {
    expect(errorOf(createLessonPlan(input))).toEqual({ field, code });
  });
});

describe('updating and duplicating', () => {
  it('updates content but keeps the identity', () => {
    const plan = valueOf(createLessonPlan(weekly()));
    const updated = valueOf(updateLessonPlan(plan, { ...conversational(), title: 'New' }));

    expect(updated).toMatchObject({ ...ids, title: 'New' });
    expect(planKind(updated)).toBe('conversational_english');
  });

  it('moves both weeks of a duplicated plan to the new start', () => {
    const plan = valueOf(
      createLessonPlan({
        ...weekly({
          weeks: [{ weekStart: '2026-09-07', objective: 'A' }, { weekStart: '2026-09-21' }],
        }),
        folderId: 'folder-1' as PlanFolderId,
      }),
    );
    const copy = duplicateLessonPlan(plan, 'plan-2' as LessonPlanId, '2026-09-14' as LocalDate);

    expect(copy).toMatchObject({ id: 'plan-2', folderId: 'folder-1' });
    expect(copy.body.kind === 'weekly' && copy.body.weeks.map((w) => w.weekStart)).toEqual([
      '2026-09-14',
      '2026-09-28',
    ]);
    expect(copy.body.kind === 'weekly' && copy.body.weeks[0]?.objective).toBe('A');
  });

  it('moves every date of a duplicated Conversational English plan', () => {
    const plan = valueOf(
      createLessonPlan(conversational({ lessonDateEnd: '2026-09-09', testQuizDate: '2026-09-11' })),
    );
    const copy = duplicateLessonPlan(plan, 'plan-2' as LessonPlanId, '2026-09-15' as LocalDate);

    expect(copy.body).toMatchObject({
      lessonDate: '2026-09-15',
      lessonDateEnd: '2026-09-16',
      testQuizDate: '2026-09-18',
    });
  });
});
