import { describe, expect, it } from 'vitest';
import { createPathRequest, type PathRequestInput } from '@thp/domain';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { PathWriter, pathWriterSystemPrompt, reviewPath } from './path-writer.ts';
import { pathMetrics, scorePath } from './path-scorecard.ts';

const requestOf = (overrides: Partial<PathRequestInput> = {}) =>
  unwrap(
    createPathRequest({
      subject: 'math',
      grade: '4',
      language: 'en',
      level: 3,
      lessonCount: 3,
      topic: 'Comparing fractions',
      review: [],
      mastered: [],
      ...overrides,
    }),
  );

const lessonJson = (n: number) => ({
  title: `Fractions on a number line ${String(n)}`,
  objective: `Place and compare fractions on a number line (${String(n)})`,
  minutes: 15,
  content:
    'A number line shows fractions in order. The farther right a fraction is, the larger it is.',
  checks: [
    {
      prompt: `Which is larger: 2/8 or 5/8? (${String(n)})`,
      options: ['2/8', '5/8'],
      correct: '5/8',
    },
    {
      prompt: `Which is smaller: 1/3 or 2/3? (${String(n)})`,
      options: ['1/3', '2/3'],
      correct: '1/3',
    },
    {
      prompt: `Where is 1/2 on a line from 0 to 1? (${String(n)})`,
      options: ['In the middle', 'At 1', 'At 0'],
      correct: 'In the middle',
    },
  ],
});

const pathReply = (lessons = 3) =>
  JSON.stringify({
    title: 'Fractions on the number line',
    description: 'Seeing fractions in order.',
    lessons: Array.from({ length: lessons }, (_, i) => lessonJson(i + 1)),
  });

const reply = (text: string, stopReason: 'end' | 'max_tokens' = 'end') => ({ text, stopReason });

describe('PathWriter', () => {
  it('asks for the lessons with the fixed rules first (cached), then this request', async () => {
    const llm = new FakeLlmClient().replyWith(pathReply());
    await new PathWriter(llm).write(
      requestOf({ review: ['Compare fractions with unlike denominators'], mastered: ['Halves'] }),
    );
    const [sent] = llm.requests;
    const message = sent?.messages[0];
    const prompt = message?.content ?? '';
    expect(sent?.system).toBe(pathWriterSystemPrompt);
    expect(message?.stablePrefix).toBeDefined();
    expect(prompt.startsWith(message?.stablePrefix ?? '?')).toBe(true);
    expect(message?.stablePrefix).toContain('"lessons"');
    expect(prompt).toContain('Write 3 lessons.');
    expect(prompt).toContain('Subject: Mathematics. Grade: 4.');
    expect(prompt).toContain('Topic: Comparing fractions\n');
    expect(prompt).toContain('Level 3 of 5: on grade level.');
    expect(prompt).toContain('Review first: Compare fractions with unlike denominators');
    expect(prompt).toContain('Already mastered (build on it, do not repeat): Halves');
    expect(prompt).toContain('Write everything in English.');
  });

  it('lets the writer choose what comes next when there is no topic', async () => {
    const llm = new FakeLlmClient().replyWith(pathReply());
    await new PathWriter(llm).write(requestOf({ topic: null, level: 1 }));
    const prompt = llm.requests[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('Topic: the next step in this subject for this grade\n');
    expect(prompt).toContain('Level 1 of 5: rebuild the foundations, below grade level.');
    expect(prompt).not.toContain('Review first');
  });

  it('returns the checked path, with each right answer as its option', async () => {
    const llm = new FakeLlmClient().replyWith(pathReply());
    const draft = unwrap(await new PathWriter(llm).write(requestOf()));
    expect(draft.title).toBe('Fractions on the number line');
    expect(draft.lessons).toHaveLength(3);
    expect(draft.lessons[0]?.checks[0]).toEqual({
      prompt: 'Which is larger: 2/8 or 5/8? (1)',
      options: ['2/8', '5/8'],
      answer: 1,
    });
  });

  it('asks again once with the problem, then gives up', async () => {
    const llm = new FakeLlmClient().replyWith('not json').replyWith(pathReply());
    expect((await new PathWriter(llm).write(requestOf())).ok).toBe(true);
    expect(llm.requests[1]?.messages.at(-1)?.content).toContain('not one JSON object');

    const failing = new FakeLlmClient().replyWith('no').replyWith('still no');
    expect(await new PathWriter(failing).write(requestOf())).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
  });
});

describe('reviewPath', () => {
  it('names the problem in plain words', () => {
    expect(reviewPath(requestOf(), reply(pathReply(), 'max_tokens'))).toMatchObject({ ok: false });
    expect(reviewPath(requestOf(), reply(pathReply(2)))).toEqual({
      ok: false,
      error: 'Write 3 lessons; there were 2.',
    });
    const wrongAnswer = JSON.parse(pathReply()) as { lessons: ReturnType<typeof lessonJson>[] };
    const first = wrongAnswer.lessons[0];
    if (first?.checks[0]) first.checks[0].correct = 'Neither';
    expect(reviewPath(requestOf(), reply(JSON.stringify(wrongAnswer)))).toMatchObject({
      ok: false,
      error: expect.stringContaining('lessons.0.checks.0.answer') as string,
    });
  });

  it('keeps only the lessons asked for when there are more', () => {
    expect(reviewPath(requestOf(), reply(pathReply(4)))).toMatchObject({
      ok: true,
      value: { lessons: { length: 3 } },
    });
  });
});

describe('scorePath', () => {
  it('scores structure, count, language, playable and focus', async () => {
    const llm = new FakeLlmClient().replyWith(pathReply());
    const request = requestOf({ review: ['number line'] });
    const draft = unwrap(await new PathWriter(llm).write(request));
    expect(scorePath(request, draft)).toEqual({
      structure: 1,
      count: 1,
      language: 1,
      playable: 1,
      focus: 1,
    });
    expect(scorePath(requestOf({ language: 'es' }), draft).language).toBe(0);
    expect(scorePath(requestOf({ review: ['photosynthesis'] }), draft).focus).toBe(0);
    expect(scorePath(request, null)).toEqual(Object.fromEntries(pathMetrics.map((m) => [m, 0])));
  });
});
