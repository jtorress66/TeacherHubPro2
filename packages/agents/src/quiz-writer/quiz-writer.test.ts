import { describe, expect, it } from 'vitest';
import type { QuizRequest } from '@thp/ports';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { QuizWriter, quizSystemPrompt } from './quiz-writer.ts';
import { scoreQuiz } from './quiz-scorecard.ts';

const request: QuizRequest = {
  subject: 'social_studies',
  grade: '7',
  topics: ['Causes of the Civil War', 'Major battles'],
  questionCount: 3,
  language: 'es',
};

const questions = [
  {
    type: 'multiple_choice',
    prompt: '¿Cuál fue una causa de la Guerra Civil?',
    options: ['La esclavitud', 'El ferrocarril'],
    correctOption: 0,
  },
  { type: 'true_false', prompt: 'Gettysburg fue una batalla importante.', answer: true },
  { type: 'short_answer', prompt: 'Nombre una batalla.', modelAnswer: 'Antietam', points: 2 },
];
const reply = (list: unknown[], instructions: string | null = 'Responda todo.') =>
  JSON.stringify({ instructions, questions: list });

describe('QuizWriter', () => {
  it('sends only the subject, grade and topics, in the teacher’s language', async () => {
    const llm = new FakeLlmClient().replyWith(reply(questions));
    await new QuizWriter(llm).write(request);

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(quizSystemPrompt);
    expect(sent?.system).toMatch(/one point/i);
    expect(prompt).toContain('Spanish (español)');
    expect(prompt).toContain('Social Studies');
    expect(prompt).toContain('Grade: 7');
    expect(prompt).toContain('Topic: Causes of the Civil War\n');
    expect(prompt).toContain('- Major battles');
    expect(prompt).toContain('exactly 3 questions');
  });

  it('returns the questions, one point each unless the reply says otherwise', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply(questions)}\n\`\`\``);
    const quiz = unwrap(await new QuizWriter(llm).write(request));
    expect(quiz.instructions).toBe('Responda todo.');
    expect(quiz.questions.map((q) => [q.id, q.type, q.points])).toEqual([
      ['q1', 'multiple_choice', 1],
      ['q2', 'true_false', 1],
      ['q3', 'short_answer', 2],
    ]);
  });

  it('asks again for the wrong count, a type it may not use, or a broken question', async () => {
    const essay = { type: 'essay', prompt: 'Escriba un ensayo.' };
    const badOption = { ...questions[0], correctOption: 5 };
    const llm = new FakeLlmClient()
      .replyWith(reply(questions.slice(0, 2)))
      .replyWith(reply([...questions.slice(0, 2), essay]));
    expect(await new QuizWriter(llm).write(request)).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toMatch(/exactly 3 questions, not 2/);

    const broken = new FakeLlmClient()
      .replyWith(reply([badOption, ...questions.slice(1)]))
      .replyWith(reply(questions));
    expect(unwrap(await new QuizWriter(broken).write(request)).questions).toHaveLength(3);
    expect(broken.requests[1]?.messages[2]?.content).toMatch(/correctOption/);

    const typed = new FakeLlmClient()
      .replyWith(reply([...questions.slice(0, 2), essay]))
      .replyWith(reply(questions));
    await new QuizWriter(typed).write(request);
    expect(typed.requests[1]?.messages[2]?.content).toMatch(/essay/);
  });

  it('asks again after a cut-off or non-JSON reply, and reports an unavailable model', async () => {
    const cut = new FakeLlmClient()
      .replyWith(reply(questions), 'max_tokens')
      .replyWith(reply(questions));
    expect(unwrap(await new QuizWriter(cut).write(request)).questions).toHaveLength(3);
    expect(cut.requests[1]?.messages[2]?.content).toMatch(/cut off/);

    const prose = new FakeLlmClient().replyWith('Aquí está.').replyWith(reply(questions));
    expect(unwrap(await new QuizWriter(prose).write(request)).questions).toHaveLength(3);

    const down = new FakeLlmClient().failWith('unavailable');
    expect(await new QuizWriter(down).write(request)).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });
});

describe('scoreQuiz', () => {
  const expected = { mentions: ['guerra', 'batalla'] };

  it('scores a good quiz full marks', async () => {
    const llm = new FakeLlmClient().replyWith(reply(questions));
    const quiz = unwrap(await new QuizWriter(llm).write(request));
    expect(scoreQuiz(expected, quiz, request)).toEqual({
      structure: 1,
      count: 1,
      types: 1,
      coverage: 1,
    });
  });

  it('scores a missing quiz zero, and a quiz that skips a topic lower', () => {
    expect(scoreQuiz(expected, null, request)).toEqual({
      structure: 0,
      count: 0,
      types: 0,
      coverage: 0,
    });
    const quiz = {
      instructions: null,
      questions: [
        {
          id: 'q1',
          type: 'essay',
          prompt: 'La guerra',
          points: 1,
          instructions: null,
          rubric: null,
        },
      ],
    } as unknown as Parameters<typeof scoreQuiz>[1];
    expect(scoreQuiz(expected, quiz, request)).toEqual({
      structure: 1,
      count: 0,
      types: 0,
      coverage: 0.5,
    });
  });
});
