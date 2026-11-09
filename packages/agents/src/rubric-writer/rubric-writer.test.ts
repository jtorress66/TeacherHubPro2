import { describe, expect, it } from 'vitest';
import { createRubricRequest, type RubricRequestInput } from '@thp/domain';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { eslGuidance } from '../drafting/esl.ts';
import { RubricWriter, reviewRubric, rubricSystemPrompt } from './rubric-writer.ts';

const request = (overrides: Partial<RubricRequestInput> = {}) =>
  unwrap(
    createRubricRequest({
      topic: 'Persuasive essay',
      subject: 'ela',
      grade: '7',
      criteriaCount: 2,
      levelCount: 3,
      language: 'es',
      ...overrides,
    }),
  );

const levels = [
  { label: 'Excelente', points: 3 },
  { label: 'Bien', points: 2 },
  { label: 'En progreso', points: 1 },
];
const criteria = [
  { name: 'Tesis', descriptors: ['Clara y defendible', 'Clara', 'Ausente'] },
  { name: 'Evidencia', descriptors: ['Sólida y citada', 'Alguna', 'Ninguna'] },
];
const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ title: 'Ensayo persuasivo', levels, criteria, ...overrides });

const review = (text: string) => reviewRubric(request(), { text, stopReason: 'end' });

describe('RubricWriter', () => {
  it('asks for the exact grid in the teacher’s language, with only the request', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new RubricWriter(llm).draft(request({ instructions: 'Focus on counterarguments' }));

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(rubricSystemPrompt);
    expect(prompt).toContain('exactly 2 criteria');
    expect(prompt).toContain('exactly 3 levels');
    expect(prompt).toContain('Write in Spanish (español).');
    expect(prompt).toContain('Subject: English Language Arts');
    expect(prompt).toContain('Grade: 7');
    expect(prompt).toContain('What to assess: Persuasive essay');
    expect(prompt).toContain("Teacher's instructions: Focus on counterarguments");
    expect(prompt).not.toContain(eslGuidance);
  });

  it('adds the ESL guidance only when the switch is on, and leaves out a blank subject', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new RubricWriter(llm).draft(request({ esl: true, subject: '', grade: '' }));

    const prompt = llm.requests[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain(eslGuidance);
    expect(prompt).not.toContain('Subject:');
    expect(prompt).not.toContain('Grade:');
  });

  it('returns the drafted grid, using the teacher’s title when given', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply()}\n\`\`\``);
    const draft = unwrap(await new RubricWriter(llm).draft(request({ title: 'Mi rúbrica' })));

    expect(draft).toEqual({ title: 'Mi rúbrica', levels, criteria });
  });

  it('retries with the reason, then gives up with invalid_output', async () => {
    const short = reply({ criteria: criteria.slice(0, 1) });
    const llm = new FakeLlmClient().replyWith(short).replyWith(short);

    expect(await new RubricWriter(llm).draft(request())).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toContain('exactly 2 criteria');
  });
});

describe('reviewRubric', () => {
  it('falls back to the topic when the reply has no title', () => {
    const draft = review(reply({ title: '' }));
    expect(draft.ok && draft.value.title).toBe('Persuasive essay');
  });

  it.each([
    ['a cut-off reply', null, /cut off/],
    ['no JSON', 'Here is your rubric', /not one JSON object/],
    ['the wrong number of levels', reply({ levels: levels.slice(0, 2) }), /exactly 3 levels/],
    ['the wrong number of criteria', reply({ criteria: [] }), /exactly 2 criteria/],
    ['points that do not go down', reply({ levels: [...levels].reverse() }), /"levels"/],
    [
      'a criterion missing a level description',
      reply({ criteria: [criteria[0], { name: 'Evidencia', descriptors: ['Sólida'] }] }),
      /"criteria.1.descriptors"/,
    ],
  ])('rejects %s', (_, text, problem) => {
    const result =
      text === null
        ? reviewRubric(request(), { text: reply(), stopReason: 'max_tokens' })
        : review(text);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(problem);
  });
});
