import { describe, expect, it } from 'vitest';
import { languages } from '../shared/language.ts';
import type {
  LessonPlanId,
  PlanFolderId,
  PlanTemplateId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createLessonPlan } from './lesson-plan.ts';
import { createDraftRequest, draftedPlan, type DraftRequestInput } from './plan-draft.ts';
import { createPlanFolder, updatePlanFolder } from './plan-folder.ts';
import { templateFromPlan } from './plan-template.ts';
import {
  findStarter,
  isoWeek,
  starterBody,
  starterTemplates,
  starterText,
  templateOfTheWeek,
} from './starter-templates.ts';

const owner = { schoolId: 'school-1' as SchoolId, teacherId: 'user-1' as UserId };

describe('plan folders', () => {
  const folder = (details: { name: string; color?: string }) =>
    createPlanFolder({ id: 'folder-1' as PlanFolderId, ...owner, ...details });

  it('takes a trimmed name and the first colour by default', () => {
    expect(valueOf(folder({ name: ' Unit 1 ' }))).toEqual({
      id: 'folder-1',
      ...owner,
      name: 'Unit 1',
      color: 'indigo',
    });
  });

  it('refuses a blank or long name and an unknown colour', () => {
    expect(errorOf(folder({ name: ' ' }))).toEqual({ field: 'name', code: 'required' });
    expect(errorOf(folder({ name: 'x'.repeat(61) }))).toEqual({ field: 'name', code: 'too_long' });
    expect(errorOf(folder({ name: 'A', color: '#ff0000' }))).toEqual({
      field: 'color',
      code: 'not_allowed',
    });
  });

  it('renames and recolours', () => {
    const saved = valueOf(folder({ name: 'A' }));
    expect(valueOf(updatePlanFolder(saved, { name: 'B', color: 'rose' }))).toMatchObject({
      id: 'folder-1',
      name: 'B',
      color: 'rose',
    });
    expect(errorOf(updatePlanFolder(saved, { name: '' }))).toEqual({
      field: 'name',
      code: 'required',
    });
  });
});

describe('starter templates', () => {
  it('has five starters, each a valid plan in every language', () => {
    expect(starterTemplates).toHaveLength(5);
    for (const starter of starterTemplates) {
      for (const language of languages) {
        const plan = createLessonPlan({
          id: 'plan-1' as LessonPlanId,
          ...owner,
          body: starterBody(starter, language, '2026-09-07'),
        });
        expect(plan.ok, `${starter.id} in ${language}`).toBe(true);
      }
    }
  });

  it('is written in English and Spanish; other languages use English', () => {
    const [starter] = starterTemplates;
    expect(starterText(starter, 'es').name).toBe('Introducción a las fracciones');
    expect(starterText(starter, 'fr').name).toBe('Introduction to Fractions');
  });

  it('starts on the chosen week with its standards', () => {
    const body = starterBody(
      findStarter('fractions-intro') ?? starterTemplates[0],
      'en',
      '2026-09-14',
    );
    expect(body.weeks[0]).toMatchObject({
      weekStart: '2026-09-14',
      standards: ['CCSS.Math.Content.3.NF.A.1', 'CCSS.Math.Content.3.NF.A.3'],
    });
    expect(findStarter('missing')).toBeNull();
  });

  it('features one starter per ISO week, in turn', () => {
    expect(isoWeek(new Date('2026-01-01T12:00:00Z'))).toBe(1);
    expect(isoWeek(new Date('2026-12-31T12:00:00Z'))).toBe(53);
    expect(isoWeek(new Date('2027-01-03T12:00:00Z'))).toBe(53);
    const thisWeek = templateOfTheWeek(new Date('2026-09-07T12:00:00Z'));
    const nextWeek = templateOfTheWeek(new Date('2026-09-14T12:00:00Z'));
    expect(thisWeek).toBe(starterTemplates[isoWeek(new Date('2026-09-07T12:00:00Z')) % 5]);
    expect(nextWeek).not.toBe(thisWeek);
    expect(templateOfTheWeek(new Date('2026-09-11T12:00:00Z'))).toBe(thisWeek);
  });
});

describe('saved templates', () => {
  const plan = valueOf(
    createLessonPlan({
      id: 'plan-1' as LessonPlanId,
      ...owner,
      title: 'Fractions',
      folderId: 'folder-1' as PlanFolderId,
      body: { kind: 'weekly', weeks: [{ weekStart: '2026-09-07', objective: 'A' }] },
    }),
  );

  it('keeps the content but not the folder', () => {
    const template = valueOf(templateFromPlan(plan, 'tpl-1' as PlanTemplateId, ' My week '));
    expect(template).toEqual({
      id: 'tpl-1',
      ...owner,
      name: 'My week',
      title: 'Fractions',
      body: plan.body,
    });
  });

  it('needs a name', () => {
    expect(errorOf(templateFromPlan(plan, 'tpl-1' as PlanTemplateId, ''))).toEqual({
      field: 'name',
      code: 'required',
    });
  });
});

describe('AI draft requests', () => {
  const request: DraftRequestInput = {
    kind: 'weekly',
    subject: 'math',
    grade: '4',
    topic: ' Fractions ',
    language: 'es',
    start: '2026-09-07',
  };

  it('fills in defaults', () => {
    expect(valueOf(createDraftRequest(request))).toEqual({
      kind: 'weekly',
      subject: 'math',
      grade: '4',
      topic: 'Fractions',
      difficulty: 'medium',
      durationMinutes: 45,
      language: 'es',
      instructions: null,
      start: '2026-09-07',
      classId: null,
    });
  });

  it('lets a Conversational English draft go without a subject or a Monday', () => {
    const ce = valueOf(
      createDraftRequest({
        ...request,
        kind: 'conversational_english',
        subject: 'ela',
        start: '2026-09-09',
      }),
    );
    expect(ce).toMatchObject({ subject: null, start: '2026-09-09' });
  });

  it.each([
    [{ kind: 'quiz' }, 'kind', 'not_allowed'],
    [{ subject: 'cooking' }, 'subject', 'not_allowed'],
    [{ subject: null }, 'subject', 'required'],
    [{ grade: '13' }, 'grade', 'not_allowed'],
    [{ topic: ' ' }, 'topic', 'required'],
    [{ difficulty: 'extreme' }, 'difficulty', 'not_allowed'],
    [{ durationMinutes: 10 }, 'durationMinutes', 'out_of_range'],
    [{ durationMinutes: 241 }, 'durationMinutes', 'out_of_range'],
    [{ durationMinutes: 45.5 }, 'durationMinutes', 'out_of_range'],
    [{ language: 'ru' }, 'language', 'not_allowed'],
    [{ instructions: 'x'.repeat(1001) }, 'instructions', 'too_long'],
    [{ start: 'next week' }, 'start', 'invalid_format'],
    [{ start: '2026-09-08' }, 'start', 'not_allowed'],
  ])('refuses %o', (change, field, code) => {
    expect(errorOf(createDraftRequest({ ...request, ...change }))).toEqual({ field, code });
  });

  it('turns a weekly draft into week 1 of a new plan', () => {
    const drafted = draftedPlan(
      {
        kind: 'weekly',
        unit: 'Fractions',
        objective: 'Compare fractions',
        skills: ['Equivalence'],
        standards: ['CCSS.Math.Content.4.NF.A.1'],
        expectations: null,
        days: [{ theme: 'Hook' }, {}, {}, {}, {}],
      },
      '2026-09-07' as LocalDate,
    );

    expect(drafted.title).toBeNull();
    const plan = valueOf(createLessonPlan({ id: 'plan-1' as LessonPlanId, ...owner, ...drafted }));
    expect(plan.body.kind === 'weekly' && plan.body.weeks[0]).toMatchObject({
      weekStart: '2026-09-07',
      objective: 'Compare fractions',
      standards: ['CCSS.Math.Content.4.NF.A.1'],
    });
  });

  it('turns a Conversational English draft into a titled plan on the lesson date', () => {
    const drafted = draftedPlan(
      {
        kind: 'conversational_english',
        title: 'At the restaurant',
        topic: 'Food',
        learningObjectives: 'Order a meal',
        materials: null,
        hook: 'Guess the dish',
        learningGoal: null,
        closure: null,
        notes: null,
      },
      '2026-09-09' as LocalDate,
    );

    const plan = valueOf(createLessonPlan({ id: 'plan-1' as LessonPlanId, ...owner, ...drafted }));
    expect(plan.title).toBe('At the restaurant');
    expect(plan.body).toMatchObject({ lessonDate: '2026-09-09', hook: 'Guess the dish' });
  });
});
