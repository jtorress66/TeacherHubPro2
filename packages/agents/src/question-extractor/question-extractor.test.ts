import { describe, expect, it } from 'vitest';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { QuestionExtractor } from './question-extractor.ts';

const pdfText = [
  'Science Quiz',
  'A. Vocabulary (6 pts) Word bank: apple, sky',
  '1. The ___ is red.',
  '2. The ___ is blue.',
  'B. True or false',
  '3. Water boils at 100 °C at sea level.',
].join('\n');

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    instructions: 'Answer every question.',
    questions: [
      {
        type: 'fill_blank',
        prompt: 'The ___ is red.',
        acceptedAnswers: ['apple'],
        points: 3,
        instructions: 'A. Vocabulary. Word bank: apple, sky',
      },
      {
        type: 'fill_blank',
        prompt: 'The ___ is blue.',
        acceptedAnswers: ['sky'],
        points: 3,
        instructions: 'A. Vocabulary. Word bank: apple, sky',
      },
      { type: 'true_false', prompt: 'Water boils at 100 °C at sea level.', answer: true },
      { type: 'essay', prompt: 'Explain the water cycle.', rubric: null, points: 10 },
    ],
    ...overrides,
  });

describe('QuestionExtractor', () => {
  it('sends the test text with the splitting rules, in the teacher’s language', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new QuestionExtractor(llm).extract({ text: pdfText, language: 'es' });

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toMatch(/EACH sentence with a blank is ONE question/);
    expect(prompt).toContain('Write the instructions and any added text in Spanish (español);');
    expect(prompt).toContain('1. The ___ is red.');
  });

  it('returns each question separately, with the word bank in its instructions', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply()}\n\`\`\``);
    const test = unwrap(
      await new QuestionExtractor(llm).extract({ text: pdfText, language: 'en' }),
    );

    expect(test.instructions).toBe('Answer every question.');
    expect(test.questions.map((q) => [q.id, q.type, q.points])).toEqual([
      ['q1', 'fill_blank', 3],
      ['q2', 'fill_blank', 3],
      ['q3', 'true_false', 10],
      ['q4', 'essay', 10],
    ]);
    expect(test.questions[0]?.instructions).toBe('A. Vocabulary. Word bank: apple, sky');
  });

  it('reads multiple choice and matching questions', async () => {
    const llm = new FakeLlmClient().replyWith(
      reply({
        questions: [
          { type: 'multiple_choice', prompt: 'Pick', options: ['a', 'b', 'c'], correctOption: 2 },
          {
            type: 'matching',
            prompt: 'Match',
            pairs: [
              { left: 'dog', right: 'perro' },
              { left: 'cat', right: 'gato' },
            ],
          },
          { type: 'short_answer', prompt: 'Why?', modelAnswer: 'Because' },
        ],
      }),
    );
    const test = unwrap(
      await new QuestionExtractor(llm).extract({ text: pdfText, language: 'en' }),
    );
    expect(test.questions[0]).toMatchObject({ options: ['a', 'b', 'c'], correctOption: 2 });
    expect(test.questions[1]).toMatchObject({
      pairs: [
        { left: 'dog', right: 'perro' },
        { left: 'cat', right: 'gato' },
      ],
    });
    expect(test.questions[2]).toMatchObject({ modelAnswer: 'Because' });
  });

  it('retries with the reason when a question breaks a rule, then gives up', async () => {
    const broken = reply({
      questions: [
        { type: 'multiple_choice', prompt: 'Pick', options: ['only one'], correctOption: 0 },
      ],
    });
    const llm = new FakeLlmClient().replyWith(broken).replyWith(broken);
    expect(await new QuestionExtractor(llm).extract({ text: pdfText, language: 'en' })).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toContain('"questions.0.options"');
  });

  it('retries when the reply has an unknown question type or no questions', async () => {
    const llm = new FakeLlmClient()
      .replyWith(reply({ questions: [{ type: 'drawing', prompt: 'Draw' }] }))
      .replyWith(reply({ questions: [] }));
    expect((await new QuestionExtractor(llm).extract({ text: pdfText, language: 'en' })).ok).toBe(
      false,
    );
    expect(llm.requests[1]?.messages[2]?.content).toContain('unknown question type "drawing"');
  });
});

describe('reviewExtraction', () => {
  it('asks for a shorter reply when it was cut off, and ignores points that are not numbers', async () => {
    const { reviewExtraction } = await import('./question-extractor.ts');
    expect(reviewExtraction({ text: '{', stopReason: 'max_tokens' })).toEqual({
      ok: false,
      error: 'The reply was cut off before the end; keep the instructions shorter.',
    });
    const test = reviewExtraction({
      text: JSON.stringify({
        questions: [{ type: 'true_false', prompt: 'Sun is a star', answer: true, points: 'ten' }],
      }),
      stopReason: 'end',
    });
    expect(test.ok && test.value.questions[0]?.points).toBe(10);
    expect(test.ok && test.value.instructions).toBeNull();
  });

  it('reports a matching pair with a blank side', async () => {
    const { reviewExtraction } = await import('./question-extractor.ts');
    const result = reviewExtraction({
      text: JSON.stringify({
        questions: [
          { type: 'matching', prompt: 'Match', pairs: [{ left: 'a' }, { left: 'b', right: 'c' }] },
        ],
      }),
      stopReason: 'end',
    });
    expect(result).toEqual({ ok: false, error: '"questions.0.pairs" breaks a rule (required).' });
  });
});
