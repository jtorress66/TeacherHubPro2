import { describe, expect, it } from 'vitest';
import { parsePlanForm, planFieldName } from './plan-forms.ts';

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe('parsePlanForm', () => {
  it('reads a one-week plan with its days, checklists and codes', () => {
    const parsed = parsePlanForm(
      form([
        ['locale', 'es'],
        ['planId', 'plan-1'],
        ['kind', 'weekly'],
        ['title', ' '],
        ['classId', 'class-1'],
        ['folderId', ''],
        ['unit', 'Fracciones'],
        ['subjectIntegration', 'science'],
        ['subjectIntegration', 'art'],
        ['w0.weekStart', '2026-09-07'],
        ['w0.objective', 'Comparar'],
        ['w0.skill.0', 'Equivalencia'],
        ['w0.skill.2', 'Recta'],
        ['w0.standards', 'CCSS.Math.Content.4.NF.A.1\n CCSS.Math.Content.4.NF.A.2,'],
        ['w0.d0.theme', 'Inicio'],
        ['w0.d0.dok', '1'],
        ['w0.d0.dok', '3'],
        ['w0.d0.eca', 'core'],
        ['w0.d0.activities', 'vocabulary'],
        ['w0.d0.activities', 'brainstorming'],
        ['w0.d0.activity.vocabulary', 'numerador'],
        ['w0.d0.activity.other', 'ignored: not ticked'],
        ['w0.d0.materials', 'book'],
        ['w0.d0.notes', '| a | b |'],
        ['w1.weekStart', '2026-09-14'],
      ]),
    );

    expect(parsed).toMatchObject({
      locale: 'es',
      planId: 'plan-1',
      title: null,
      classId: 'class-1',
      folderId: null,
    });
    expect(parsed.body).toMatchObject({
      kind: 'weekly',
      unit: 'Fracciones',
      story: null,
      subjectIntegration: ['science', 'art'],
    });
    const weeks = parsed.body.kind === 'weekly' ? parsed.body.weeks : [];
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      weekStart: '2026-09-07',
      objective: 'Comparar',
      skills: ['Equivalencia', '', 'Recta', ''],
      standards: ['CCSS.Math.Content.4.NF.A.1', 'CCSS.Math.Content.4.NF.A.2', ''],
    });
    expect(weeks[0]?.days?.[0]).toEqual({
      theme: 'Inicio',
      dok: [1, 3],
      eca: ['core'],
      activities: [
        { type: 'brainstorming', notes: null },
        { type: 'vocabulary', notes: 'numerador' },
      ],
      materials: ['book'],
      notes: '| a | b |',
    });
    expect(weeks[0]?.days).toHaveLength(5);
  });

  it('reads the second week only when it is switched on', () => {
    const parsed = parsePlanForm(
      form([
        ['kind', 'weekly'],
        ['hasWeek2', 'on'],
        ['w0.weekStart', '2026-09-07'],
        ['w1.weekStart', '2026-09-14'],
      ]),
    );
    expect(parsed.body.kind === 'weekly' && parsed.body.weeks.map((w) => w.weekStart)).toEqual([
      '2026-09-07',
      '2026-09-14',
    ]);
    expect(parsed.locale).toBe('en');
  });

  it('reads a Conversational English plan', () => {
    const parsed = parsePlanForm(
      form([
        ['kind', 'conversational_english'],
        ['title', 'Café'],
        ['lessonDate', '2026-09-08'],
        ['hook', 'Menus'],
        ['notes', 'I would like ___'],
      ]),
    );
    expect(parsed.title).toBe('Café');
    expect(parsed.body).toEqual({
      kind: 'conversational_english',
      subject: null,
      lessonDate: '2026-09-08',
      lessonDateEnd: null,
      topic: null,
      learningObjectives: null,
      materials: null,
      hook: 'Menus',
      learningGoal: null,
      closure: null,
      testQuizDate: null,
      notes: 'I would like ___',
    });
  });

  it('treats an unknown kind as weekly', () => {
    expect(parsePlanForm(form([['kind', 'daily']])).body.kind).toBe('weekly');
  });
});

describe('planFieldName', () => {
  it.each([
    ['weeks.0.weekStart', 'w0.weekStart'],
    ['weeks.1.days.2.theme', 'w1.d2.theme'],
    ['weeks.0.standards', 'w0.standards'],
    ['title', 'title'],
    ['lessonDateEnd', 'lessonDateEnd'],
  ])('maps %s to %s', (path, name) => {
    expect(planFieldName(path)).toBe(name);
  });
});
