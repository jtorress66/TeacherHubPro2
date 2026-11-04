import { describe, expect, it } from 'vitest';
import { createGameRequest, type GameRequestInput } from '@thp/domain';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { gameWriterSystemPrompt, GameWriter, reviewGame } from './game-writer.ts';
import { wordingFor } from './game-formats.ts';

const requestOf = (overrides: Partial<GameRequestInput> = {}) =>
  unwrap(
    createGameRequest({
      kind: 'pairs',
      subject: 'science',
      grade: '4',
      topic: 'The solar system',
      language: 'es',
      count: 4,
      ...overrides,
    }),
  );

const pairsReply = JSON.stringify({
  items: [
    { term: 'Sol', definition: 'La estrella del sistema solar' },
    { term: 'Luna', definition: 'El satélite de la Tierra' },
    { term: 'Cometa', definition: 'Bola de hielo con cola' },
    { term: 'Órbita', definition: 'El camino alrededor de un astro' },
    { term: 'Marte', definition: 'El planeta rojo' },
  ],
});

const pairItems = (JSON.parse(pairsReply) as { items: unknown[] }).items;

const reply = (text: string, stopReason: 'end' | 'max_tokens' = 'end') => ({
  text,
  stopReason,
});

describe('GameWriter', () => {
  it('asks for the kind, topic, grade wording, language and count, and nothing about students', async () => {
    const llm = new FakeLlmClient().replyWith(pairsReply);
    await new GameWriter(llm).write(requestOf({ avoid: ['Sol'] }));

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(gameWriterSystemPrompt);
    expect(prompt).toContain('Write 4 key terms with a short definition each');
    expect(prompt).toContain('Subject: Science. Grade: 4. Topic: The solar system.');
    expect(prompt).toContain(wordingFor('4'));
    expect(prompt).toContain('Write everything in Spanish (español).');
    expect(prompt).toContain('Do not repeat these items: Sol');
    expect(prompt).not.toMatch(/student name|roster/i);
  });

  it('asks for the difficulty, and aligns to a standard with its official wording when given', async () => {
    const llm = new FakeLlmClient().replyWith(pairsReply).replyWith(pairsReply);
    await new GameWriter(llm).write(requestOf({ subject: 'math', difficulty: 'hard' }));
    await new GameWriter(llm).write(
      requestOf({ subject: 'math', standard: 'CCSS.Math.Content.4.NF.A.1' }),
    );
    const [plain, aimed] = llm.requests.map((r) => r.messages[0]?.content ?? '');
    expect(plain).toContain('Difficulty: hard.');
    expect(plain).not.toContain('Common Core');
    expect(aimed).toContain('Difficulty: medium.');
    expect(aimed).toMatch(
      /Align every item with the Common Core standard CCSS\.Math\.Content\.4\.NF\.A\.1: \S/,
    );
  });

  it('returns the checked content, trimmed to the count asked for', async () => {
    const llm = new FakeLlmClient().replyWith(pairsReply);
    const content = unwrap(await new GameWriter(llm).write(requestOf()));
    expect(content.kind).toBe('pairs');
    expect(content.items).toHaveLength(4);
  });

  it('asks again with the problem when the reply breaks a rule, then gives up', async () => {
    const llm = new FakeLlmClient()
      .replyWith('{"items": [{"term": "TODO", "definition": "x"}]}')
      .replyWith(pairsReply);
    expect(unwrap(await new GameWriter(llm).write(requestOf())).items).toHaveLength(4);
    expect(llm.requests[1]?.messages.at(-1)?.content).toMatch(/could not be used/);

    const failing = new FakeLlmClient().replyWith('nonsense').replyWith('nonsense');
    expect(await new GameWriter(failing).write(requestOf())).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
  });
});

describe('reviewGame', () => {
  it('reads multiple-choice questions, finding the right option by its text', () => {
    const request = requestOf({ kind: 'questions', count: 3 });
    const items = [1, 2, 3].map((n) => ({
      prompt: `Pregunta ${String(n)}?`,
      options: ['Marte', 'Venus', 'Júpiter'],
      correct: 'Venus',
    }));
    const content = unwrap(reviewGame(request, reply(JSON.stringify({ items }))));
    expect(content).toMatchObject({
      kind: 'questions',
      items: [{ answer: 1 }, { answer: 1 }, { answer: 1 }],
    });
  });

  it('reads every other kind', () => {
    const cases = [
      {
        kind: 'statements',
        count: 3,
        items: [1, 2, 3].map((n) => ({ statement: `Frase ${String(n)}`, isTrue: n === 2 })),
      },
      {
        kind: 'sentences',
        count: 3,
        items: [
          { text: 'El ___ brilla de día.', answer: 'sol' },
          { text: 'La ___ sale de noche.', answer: 'luna' },
          { text: 'El ___ es salado.', answer: 'mar' },
        ],
      },
      { kind: 'steps', count: 3, items: ['Uno', 'Dos', 'Tres'] },
      {
        kind: 'groups',
        count: 2,
        items: [
          { name: 'Planetas', members: ['Marte', 'Venus', 'Saturno'] },
          { name: 'Estrellas', members: ['Sol', 'Vega', 'Sirio'] },
        ],
      },
    ];
    for (const { kind, count, items } of cases) {
      const content = unwrap(
        reviewGame(requestOf({ kind, count }), reply(JSON.stringify({ items }))),
      );
      expect(content.kind).toBe(kind);
      expect(content.items).toHaveLength(count);
    }
  });

  it('explains what is wrong in words the model can act on', () => {
    const request = requestOf();
    expect(reviewGame(request, reply(pairsReply, 'max_tokens'))).toEqual({
      ok: false,
      error: 'The reply was cut off; keep items shorter.',
    });
    expect(reviewGame(request, reply('no json'))).toEqual({
      ok: false,
      error: 'The reply was not one JSON object.',
    });
    const short = JSON.stringify({ items: pairItems.slice(0, 3) });
    expect(reviewGame(request, reply(short))).toEqual({
      ok: false,
      error: 'Write 4 items; there were 3.',
    });
    const placeholder = JSON.stringify({
      items: [...pairItems.slice(0, 3), { term: 'Lorem ipsum', definition: 'x' }],
    });
    expect(reviewGame(request, reply(placeholder))).toEqual({
      ok: false,
      error: '"items.3.term" breaks a rule (not_allowed).',
    });
  });

  it('applies each kind’s answer rules', () => {
    const items = [1, 2, 3].map((n) => ({
      prompt: `P${String(n)}?`,
      options: ['A1', 'B2'],
      correct: 'C3',
    }));
    expect(
      reviewGame(requestOf({ kind: 'questions', count: 3 }), reply(JSON.stringify({ items }))),
    ).toEqual({
      ok: false,
      error: '"items.0.answer" breaks a rule (out_of_range).',
    });
  });
});
