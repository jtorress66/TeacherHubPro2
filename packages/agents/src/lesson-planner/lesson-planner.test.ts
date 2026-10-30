import { describe, expect, it } from 'vitest';
import {
  createDraftRequest,
  type ClassId,
  type DraftRequest,
  type DraftRequestInput,
} from '@thp/domain';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { LessonPlanner } from './lesson-planner.ts';
import { allowedStandards } from './plan-formats.ts';

const request = (overrides: Partial<DraftRequestInput> = {}): DraftRequest =>
  unwrap(
    createDraftRequest({
      kind: 'weekly',
      subject: 'math',
      grade: '4',
      topic: 'Comparing fractions',
      language: 'es',
      start: '2026-09-07',
      instructions: 'Use pizza examples',
      ...overrides,
    }),
  );

const day = (theme: string) => ({
  theme,
  dok: [1, 2, 7],
  activities: [
    { type: 'brainstorming', notes: 'Lluvia de ideas (10 min)' },
    { type: 'dancing', notes: 'no' },
    'not an object',
  ],
  materials: ['book', 'laptop'],
  notes: `${theme}: actividades con los estudiantes`,
});

const weeklyReply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    unit: 'Fracciones',
    objective: 'Los estudiantes comparan fracciones',
    skills: ['Equivalencia', 'Recta numérica', 'Comparar', 'Razonar', 'Extra'],
    standards: [
      'CCSS.Math.Content.4.NF.A.1',
      'CCSS.Math.Content.4.NF.A.1',
      'CCSS.Math.Content.4.NF.Z.9',
      'CCSS.Math.Content.7.NS.A.1',
    ],
    expectations: 'Explicar por qué 1/2 = 2/4',
    days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(day),
    ...overrides,
  });

describe('LessonPlanner (weekly)', () => {
  it('asks only for what the plan needs, in the teacher’s language, with the official codes', async () => {
    const llm = new FakeLlmClient().replyWith(weeklyReply());
    await new LessonPlanner(llm).draft(request({ classId: 'class-secret-id' as ClassId }));

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toMatch(/Never invent standards codes/);
    expect(prompt).toContain('Write in Spanish (español).');
    expect(prompt).toContain('Subject: Mathematics');
    expect(prompt).toContain('Grade: 4');
    expect(prompt).toContain('Topic: Comparing fractions');
    expect(prompt).toContain("Teacher's instructions: Use pizza examples");
    expect(prompt).toContain('CCSS.Math.Content.4.NF.A.1:');
    expect(prompt).not.toContain('CCSS.Math.Content.7.NS.A.1');
    expect(JSON.stringify(sent)).not.toContain('class-secret-id');
  });

  it('maps the reply onto the plan, dropping unknown values and codes not on the list', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${weeklyReply()}\n\`\`\``);
    const draft = unwrap(await new LessonPlanner(llm).draft(request()));

    expect(draft).toMatchObject({
      kind: 'weekly',
      unit: 'Fracciones',
      objective: 'Los estudiantes comparan fracciones',
      skills: ['Equivalencia', 'Recta numérica', 'Comparar', 'Razonar'],
      standards: ['CCSS.Math.Content.4.NF.A.1'],
      expectations: 'Explicar por qué 1/2 = 2/4',
    });
    expect(draft.kind === 'weekly' && draft.days[0]).toEqual({
      theme: 'Lunes',
      dok: [1, 2],
      activities: [{ type: 'brainstorming', notes: 'Lluvia de ideas (10 min)' }],
      materials: ['book'],
      notes: 'Lunes: actividades con los estudiantes',
    });
  });

  it('tells the model there are no codes for science before grade 6', async () => {
    const llm = new FakeLlmClient().replyWith(weeklyReply({ standards: [] }));
    const k5 = request({ subject: 'science', grade: '3' });
    await new LessonPlanner(llm).draft(k5);

    expect(allowedStandards(k5)).toEqual([]);
    expect(llm.requests[0]?.messages[0]?.content).toContain('return "standards": []');
  });

  it('asks once more after a bad reply, then uses the corrected one', async () => {
    const llm = new FakeLlmClient().replyWith('Here is your plan!').replyWith(weeklyReply());
    const draft = await new LessonPlanner(llm).draft(request());

    expect(draft.ok).toBe(true);
    expect(llm.requests[1]?.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('tells the model the length limits, and on a retry which field broke a rule', async () => {
    const longTheme = weeklyReply({ days: ['x'.repeat(300), 'b', 'c', 'd', 'e'].map(day) });
    const llm = new FakeLlmClient().replyWith(longTheme).replyWith(weeklyReply());
    await new LessonPlanner(llm).draft(request());

    expect(llm.requests[0]?.messages[0]?.content).toContain(
      '"theme": string (at most 200 characters)',
    );
    expect(llm.requests[1]?.messages[2]?.content).toContain('"weeks.0.days.0.theme" is too long');
  });

  it.each([
    ['text with no JSON', 'Sorry'],
    ['a JSON array', '[1, 2]'],
    ['broken JSON', '{"objective": '],
    ['four days', weeklyReply({ days: ['a', 'b', 'c', 'd'].map(day) })],
    ['no objective', weeklyReply({ objective: '  ' })],
    ['an over-long theme', weeklyReply({ days: ['x'.repeat(300), 'b', 'c', 'd', 'e'].map(day) })],
  ])('gives up with invalid_output after two replies with %s', async (_, reply) => {
    const llm = new FakeLlmClient().replyWith(reply).replyWith(reply);
    expect(await new LessonPlanner(llm).draft(request())).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests).toHaveLength(2);
  });

  it.each(['rate_limited', 'unavailable', 'refused'] as const)(
    'reports a %s model as ai_unavailable',
    async (code) => {
      const llm = new FakeLlmClient().failWith(code);
      expect(await new LessonPlanner(llm).draft(request())).toEqual({
        ok: false,
        error: { code: 'ai_unavailable' },
      });
    },
  );
});

describe('LessonPlanner (Conversational English)', () => {
  const ceRequest = () =>
    request({ kind: 'conversational_english', subject: null, start: '2026-09-09', language: 'en' });

  it('asks for the lesson sections without subject or standards', async () => {
    const llm = new FakeLlmClient().replyWith(
      JSON.stringify({
        title: 'At the restaurant',
        topic: 'Ordering food',
        learningObjectives: 'Order a meal politely',
        materials: 'Menus',
        hook: 'Guess the dish',
        learningGoal: 'I can order food',
        closure: 'Role play',
        notes: 'I would like ___, please.',
        standards: ['made up'],
      }),
    );
    const draft = unwrap(await new LessonPlanner(llm).draft(ceRequest()));

    const prompt = llm.requests[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('Conversational English');
    expect(prompt).not.toContain('Subject:');
    expect(prompt).not.toContain('Common Core');
    expect(draft).toEqual({
      kind: 'conversational_english',
      title: 'At the restaurant',
      topic: 'Ordering food',
      learningObjectives: 'Order a meal politely',
      materials: 'Menus',
      hook: 'Guess the dish',
      learningGoal: 'I can order food',
      closure: 'Role play',
      notes: 'I would like ___, please.',
    });
  });

  it('needs a title', async () => {
    const reply = JSON.stringify({ topic: 'Food' });
    const llm = new FakeLlmClient().replyWith(reply).replyWith(reply);
    expect((await new LessonPlanner(llm).draft(ceRequest())).ok).toBe(false);
  });
});
