import { describe, expect, it } from 'vitest';
import { leniencyFor, type GradingRequest, type QuestionId } from '@thp/domain';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { SubmissionGrader } from './submission-grader.ts';

const request: GradingRequest = {
  language: 'es',
  leniency: leniencyFor('3'),
  questions: [
    {
      id: 'q3' as QuestionId,
      type: 'short_answer',
      prompt: '¿Por qué llueve?',
      points: 5,
      guide: 'El agua de las nubes cae cuando las gotas pesan.',
      answer: 'Porque las nubes tienen mucha agua',
    },
    {
      id: 'q4' as QuestionId,
      type: 'essay',
      prompt: 'Describe el ciclo del agua.',
      points: 10,
      guide: null,
      answer: 'El agua se evapora y vuelve a caer.',
    },
  ],
};

const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    scores: {
      q3: { score: 4, feedback: 'Muy bien, explicas la idea principal.' },
      q4: { score: 6.5, feedback: 'Buen inicio; añade la condensación.' },
    },
    feedback: '¡Buen trabajo!',
    ...overrides,
  });

describe('SubmissionGrader', () => {
  it('sends only the questions, guides and answers, with the leniency and language', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new SubmissionGrader(llm).grade(request);

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toMatch(/drafts that the teacher reviews/);
    expect(prompt).toContain('Write the feedback in Spanish (español).');
    expect(prompt).toContain('Leniency: high');
    expect(prompt).toContain('Be lenient with spelling');
    expect(prompt).toContain('"id": "q3"');
    expect(prompt).toContain('Porque las nubes tienen mucha agua');
    expect(prompt).toContain('El agua de las nubes cae');
  });

  it('returns a score and feedback for every open question', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    expect(unwrap(await new SubmissionGrader(llm).grade(request))).toEqual({
      scores: {
        q3: { score: 4, feedback: 'Muy bien, explicas la idea principal.' },
        q4: { score: 6.5, feedback: 'Buen inicio; añade la condensación.' },
      },
      feedback: '¡Buen trabajo!',
    });
  });

  it.each([
    [
      'a score above the points',
      reply({ scores: { q3: { score: 9, feedback: 'x' }, q4: { score: 1, feedback: 'x' } } }),
      /"q3" must be between 0 and 5/,
    ],
    [
      'a negative score',
      reply({ scores: { q3: { score: -1, feedback: 'x' }, q4: { score: 1, feedback: 'x' } } }),
      /"q3" must be between 0 and 5/,
    ],
    [
      'a missing question',
      reply({ scores: { q3: { score: 1, feedback: 'x' } } }),
      /Score every question: "q4" is missing/,
    ],
    ['no JSON', 'Great work!', /not one JSON object/],
  ])('retries with the reason after %s, then gives up', async (_, text, problem) => {
    const llm = new FakeLlmClient().replyWith(text).replyWith(text);
    expect(await new SubmissionGrader(llm).grade(request)).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toMatch(problem);
  });

  it('ignores scores for questions it was not asked about', async () => {
    const llm = new FakeLlmClient().replyWith(
      reply({
        scores: {
          q1: { score: 99, feedback: 'not asked' },
          q3: { score: 1, feedback: 'ok' },
          q4: { score: 2, feedback: 'ok' },
        },
      }),
    );
    const graded = unwrap(await new SubmissionGrader(llm).grade(request));
    expect(Object.keys(graded.scores)).toEqual(['q3', 'q4']);
  });
});

describe('reviewScores', () => {
  it('asks for shorter feedback when cut off, and needs a scores object', async () => {
    const { reviewScores } = await import('./submission-grader.ts');
    expect(reviewScores(request, { text: '{', stopReason: 'max_tokens' }).ok).toBe(false);
    expect(reviewScores(request, { text: '{"scores": 3}', stopReason: 'end' })).toEqual({
      ok: false,
      error: 'Score every question: "q3" is missing.',
    });
    expect(
      reviewScores(request, {
        text: '{"scores": {"q3": {"score": "4"}, "q4": {"score": 1}}}',
        stopReason: 'end',
      }),
    ).toEqual({ ok: false, error: 'The score for "q3" must be between 0 and 5.' });
  });

  it('keeps blank feedback as empty text', async () => {
    const { reviewScores } = await import('./submission-grader.ts');
    expect(
      reviewScores(request, {
        text: '{"scores": {"q3": {"score": 1}, "q4": {"score": 2}}}',
        stopReason: 'end',
      }),
    ).toEqual({
      ok: true,
      value: {
        scores: { q3: { score: 1, feedback: '' }, q4: { score: 2, feedback: '' } },
        feedback: '',
      },
    });
  });

  it('tells the model that spelling counts from grade 4', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new SubmissionGrader(llm).grade({ ...request, leniency: leniencyFor('9') });
    expect(llm.requests[0]?.messages[0]?.content).toContain('Spelling counts a little.');
  });
});
