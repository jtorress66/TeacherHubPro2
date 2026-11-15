import { describe, expect, it } from 'vitest';
import { questionPartSize, type JobProgress } from '@thp/domain';
import { FakeLlmClient, aContentRequest } from '@thp/testing';
import { ContentWriter } from './content-writer.ts';
import { countQuestions } from './content-scorecard.ts';
import { readQuizPart } from './quiz-parts.ts';

const quiz = (questionCount: number) =>
  aContentRequest({
    type: 'quiz',
    questionCount,
    topic: 'The water cycle',
    instructions: 'Use rain',
  });

/** A part as the model writes it: questions from–to, then their answers with the same numbers. */
function part(from: number, to: number, options: { title?: boolean; stem?: string } = {}): string {
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return [
    ...(options.title === false ? [] : ['# Quiz: The water cycle', '']),
    '## Questions',
    '',
    ...numbers.flatMap((n) => [
      `${String(n)}. ${options.stem ?? 'What happens in step'} ${String(n)} of the cycle?`,
      '   a) Rain',
      '   b) Snow',
      '',
    ]),
    '## Answer key',
    '',
    ...numbers.map((n) => `${String(n)}. a) Rain`),
    '',
    ...(from === 1 ? ['Standard: CCSS.ELA-Literacy.RST.6-8.4'] : []),
  ].join('\n');
}

const promptOf = (llm: FakeLlmClient, index: number) =>
  llm.requests[index]?.messages[0]?.content ?? '';

/** The numbers of the numbered lines that start each section with numbered lines, in order. */
const numbersIn = (markdown: string, heading: string) => {
  const section = markdown.split(/^## /m).find((s) => s.startsWith(heading)) ?? '';
  return [...section.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
};

const oneTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('ContentWriter, long quizzes', () => {
  it('writes a 75-question quiz in three parts of 25 and merges them into one numbered quiz', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(part(26, 50, { title: false }))
      .replyWith(part(51, 75, { title: false }));
    const result = await new ContentWriter(llm).write(quiz(75));

    expect(llm.requests).toHaveLength(3);
    expect(promptOf(llm, 0)).toContain('questions 1 to 25');
    expect(promptOf(llm, 1)).toContain('questions 26 to 50');
    expect(promptOf(llm, 2)).toContain('questions 51 to 75');
    const content = result.ok ? result.value : '';
    expect(countQuestions(content)).toBe(75);
    expect(numbersIn(content, 'Questions')).toEqual(oneTo(75));
    expect(numbersIn(content, 'Answer key')).toEqual(oneTo(75));
    expect(content.match(/^## Answer key/gm)).toHaveLength(1);
    // One answer list, read as a single numbered list: no gap where the parts meet.
    expect(content).toContain('25. a) Rain\n26. a) Rain');
    expect(content).toContain('50. a) Rain\n51. a) Rain');
    expect(content.match(/^# /gm)).toHaveLength(1);
    expect(content).toContain('Standard: CCSS.ELA-Literacy.RST.6-8.4');
    expect(content.indexOf('75. a) Rain')).toBeLessThan(content.indexOf('Standard:'));
  });

  it('shows each later part the earlier questions so it does not repeat them', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(part(26, 50, { title: false }))
      .replyWith(part(51, 75, { title: false }));
    await new ContentWriter(llm).write(quiz(75));

    expect(promptOf(llm, 0)).not.toContain('step 1 of the cycle');
    expect(promptOf(llm, 1)).toContain('1. What happens in step 1 of the cycle?');
    expect(promptOf(llm, 1)).toContain('25. What happens in step 25 of the cycle?');
    expect(promptOf(llm, 1)).not.toContain('a) Rain');
    expect(promptOf(llm, 2)).toContain('50. What happens in step 50 of the cycle?');
  });

  it('puts what all parts share first, as one cacheable prefix without any part’s details', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(part(26, 50, { title: false }))
      .replyWith(part(51, 75, { title: false }));
    await new ContentWriter(llm).write(quiz(75));

    const prefixes = llm.requests.map((sent) => sent.messages[0]?.stablePrefix ?? '');
    expect(new Set(prefixes).size).toBe(1);
    const [prefix = ''] = prefixes;
    expect(prefix).toContain('Topic: The water cycle');
    expect(prefix).toContain("Teacher's instructions: Use rain");
    expect(prefix).toContain('Write in English');
    expect(prefix).not.toMatch(/questions \d+ to \d+/);
    expect(prefix).not.toContain('step 1 of the cycle');
    for (const sent of llm.requests) {
      expect(sent.messages[0]?.content.startsWith(prefix)).toBe(true);
      expect(sent.system).toBe(llm.requests[0]?.system);
    }
  });

  it('reports which questions it is writing while the parts run', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(part(26, 50, { title: false }))
      .replyWith(part(51, 60, { title: false }));
    const seen: JobProgress[] = [];
    await new ContentWriter(llm).write(quiz(60), (progress) => {
      seen.push(progress);
      return Promise.resolve();
    });
    expect(seen).toEqual([
      { from: 1, to: 25, total: 60 },
      { from: 26, to: 50, total: 60 },
      { from: 51, to: 60, total: 60 },
    ]);
  });

  it('asks once more for a part that comes back short, then keeps going', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(part(26, 40, { title: false }))
      .replyWith(part(26, 50, { title: false }));
    const result = await new ContentWriter(llm).write(quiz(50));

    expect(llm.requests).toHaveLength(3);
    expect(llm.requests[2]?.messages[2]?.content).toContain('26. to 50.');
    expect(result.ok && countQuestions(result.value)).toBe(50);
  });

  it('fails the whole quiz, never a partial one, when a part fails twice', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith('Sorry, no.')
      .replyWith(part(26, 40, { title: false }));
    expect(await new ContentWriter(llm).write(quiz(75))).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests).toHaveLength(3);
  });

  it('fails when the model is down during a part', async () => {
    const llm = new FakeLlmClient().replyWith(part(1, 25)).failWith('unavailable');
    expect(await new ContentWriter(llm).write(quiz(30))).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });

  it('asks again when a part repeats an earlier question', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(
        part(26, 50, { title: false }).replace(
          '26. What happens in step 26',
          '26. What happens in step 3',
        ),
      )
      .replyWith(part(26, 50, { title: false }));
    const result = await new ContentWriter(llm).write(quiz(50));
    expect(llm.requests[2]?.messages[2]?.content).toContain('repeats');
    expect(result.ok).toBe(true);
  });

  it('writes 25 questions or fewer in one call, as before', async () => {
    const llm = new FakeLlmClient().replyWith(part(1, 25));
    const progress: JobProgress[] = [];
    const result = await new ContentWriter(llm).write(quiz(25), (p) => {
      progress.push(p);
      return Promise.resolve();
    });
    expect(llm.requests).toHaveLength(1);
    expect(promptOf(llm, 0)).toContain('exactly 25 questions');
    expect(promptOf(llm, 0)).not.toMatch(/questions 1 to 25/);
    expect(result.ok && countQuestions(result.value)).toBe(25);
    expect(progress).toEqual([]);
    expect(questionPartSize).toBe(25);
  });

  it('writes the longest quiz allowed, 100 questions, in four parts', async () => {
    const llm = new FakeLlmClient()
      .replyWith(part(1, 25))
      .replyWith(part(26, 50, { title: false }))
      .replyWith(part(51, 75, { title: false }))
      .replyWith(part(76, 100, { title: false }));
    const result = await new ContentWriter(llm).write(quiz(100));
    expect(llm.requests).toHaveLength(4);
    expect(result.ok && numbersIn(result.value, 'Answer key')).toEqual(oneTo(100));
  });
});

describe('readQuizPart', () => {
  const range = { from: 26, to: 28 };

  it('reads the questions, their stems and where the questions and answers end', () => {
    const read = readQuizPart(part(26, 28, { title: false }), range, []);
    expect(read.ok && read.value.stems).toEqual([
      'What happens in step 26 of the cycle?',
      'What happens in step 27 of the cycle?',
      'What happens in step 28 of the cycle?',
    ]);
  });

  it.each([
    ['the wrong numbers', part(1, 3, { title: false }), /26\. to 28\./],
    ['no answer key', part(26, 28, { title: false }).split('## Answer key')[0] ?? '', /answer key/],
    [
      'answers with the wrong numbers',
      part(26, 28, { title: false }).replace('28. a) Rain', ''),
      /answer key 26\. to 28\./,
    ],
    ['no questions', '# Quiz\n\nNothing here.', /26\. to 28\./],
  ])('refuses a part with %s', (_name, text, problem) => {
    const read = readQuizPart(text, range, []);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toMatch(problem);
  });

  it('keeps the explanation under the last answer with it, and notes after it at the end', async () => {
    const first = part(1, 25).replace(
      '25. a) Rain\n',
      '25. a) Rain\n   Rain is liquid precipitation.\n',
    );
    const llm = new FakeLlmClient().replyWith(first).replyWith(part(26, 30, { title: false }));
    const result = await new ContentWriter(llm).write(quiz(30));
    const content = result.ok ? result.value : '';
    // Repeated spaces are collapsed when unknown codes are removed.
    expect(content).toContain('25. a) Rain\n Rain is liquid precipitation.\n26. a) Rain');
    expect(content.trimEnd().endsWith('Standard: CCSS.ELA-Literacy.RST.6-8.4')).toBe(true);
  });

  it('refuses a question written earlier, whatever its case and punctuation', () => {
    const read = readQuizPart(part(26, 28, { title: false }), range, [
      'what happens in STEP 27 of the cycle',
    ]);
    expect(!read.ok && read.error).toMatch(/Question 27 repeats/);
  });
});
