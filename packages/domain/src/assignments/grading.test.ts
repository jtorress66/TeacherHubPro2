import { describe, expect, it } from 'vitest';
import { createAssignment, type Assignment } from '../gradebook/assignment.ts';
import { createQuestion, type Question, type QuestionInput } from '../gradebook/question.ts';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  QuestionId,
  SchoolId,
  StudentId,
  SubmissionId,
} from '../shared/ids.ts';
import { pendingOpenQuestions, recordAiScores, submitAnswers } from './grading.ts';
import type { ExtractedQuestionInput } from './extracted-test.ts';

const q = (id: string, input: ExtractedQuestionInput): Question => {
  const created = createQuestion({ id: id as QuestionId, ...input } as QuestionInput);
  if (!created.ok) throw new Error('bad question');
  return created.value;
};

const assignmentWith = (
  questions: Question[],
  dueDate: string | null = '2026-09-10',
): Assignment => {
  const created = createAssignment({
    id: 'a-1' as AssignmentId,
    schoolId: 'school-1' as SchoolId,
    classId: 'class-1' as ClassId,
    categoryId: 'cat-1' as GradeCategoryId,
    title: 'Quiz',
    dueDate,
    questions,
  });
  if (!created.ok) throw new Error('bad assignment');
  return created.value;
};

const mc = q('q1', {
  type: 'multiple_choice',
  prompt: 'Pick',
  options: ['a', 'b'],
  correctOption: 1,
  points: 4,
});
const tf = q('q2', { type: 'true_false', prompt: 'True?', answer: true, points: 2 });
const short = q('q3', { type: 'short_answer', prompt: 'Why?', points: 5 });
const essay = q('q4', { type: 'essay', prompt: 'Write', points: 10 });

const submit = (
  assignment: Assignment,
  answers: Record<string, string>,
  at = '2026-09-09T15:00:00Z',
) =>
  submitAnswers({
    id: 'sub-1' as SubmissionId,
    assignment,
    studentId: 'student-1' as StudentId,
    answers,
    submittedAt: new Date(at),
  });

describe('submitAnswers', () => {
  it('scores objective questions on submit and gives a draft when nothing needs judgement', () => {
    const result = submit(assignmentWith([mc, tf]), { q1: '1', q2: 'false' });

    expect(result.ok && result.value).toMatchObject({
      status: 'ai_graded',
      answers: { q1: '1', q2: 'false' },
      questionScores: {
        q1: { score: 4, feedback: null, source: 'auto' },
        q2: { score: 0, feedback: null, source: 'auto' },
      },
      aiDraft: { score: 4, feedback: '' },
      maxPoints: 6,
      late: false,
    });
  });

  it('waits for judgement when an open question was answered', () => {
    const result = submit(assignmentWith([mc, short, essay]), { q1: '1', q3: 'Because', q4: '' });
    if (!result.ok) throw new Error('refused');

    expect(result.value.status).toBe('submitted');
    expect(result.value.questionScores).toEqual({
      q1: { score: 4, feedback: null, source: 'auto' },
      q4: { score: 0, feedback: null, source: 'auto' },
    });
    expect(pendingOpenQuestions(assignmentWith([mc, short, essay]), result.value)).toEqual([short]);
  });

  it('marks a submission after the due date as late, still accepting it', () => {
    const result = submit(assignmentWith([mc]), { q1: '1' }, '2026-09-12T08:00:00Z');
    expect(result.ok && result.value.late).toBe(true);
    const undated = submit(assignmentWith([mc], null), { q1: '1' }, '2030-01-01T00:00:00Z');
    expect(undated.ok && undated.value.late).toBe(false);
  });

  it('refuses answers to unknown questions and invalid answers', () => {
    expect(submit(assignmentWith([mc]), { q9: '1' })).toEqual({
      ok: false,
      error: { field: 'q9', code: 'not_allowed' },
    });
    expect(submit(assignmentWith([mc]), { q1: '7' })).toEqual({
      ok: false,
      error: { field: 'q1', code: 'out_of_range' },
    });
  });

  it('refuses an assignment without questions', () => {
    expect(submit(assignmentWith([]), {})).toEqual({
      ok: false,
      error: { field: 'questions', code: 'required' },
    });
  });
});

describe('recordAiScores', () => {
  const assignment = assignmentWith([mc, short, essay]);
  const submitted = submit(assignment, { q1: '1', q3: 'Because', q4: 'An essay' });
  if (!submitted.ok) throw new Error('refused');

  it('adds the AI’s scores for open answers and makes the total a draft', () => {
    const graded = recordAiScores(assignment, submitted.value, {
      scores: {
        q3: { score: 3, feedback: 'Good start' },
        q4: { score: 7.5, feedback: 'Clear ideas' },
      },
      feedback: 'Nice work',
    });

    expect(graded.ok && graded.value).toMatchObject({
      status: 'ai_graded',
      questionScores: {
        q1: { score: 4, source: 'auto' },
        q3: { score: 3, feedback: 'Good start', source: 'ai' },
        q4: { score: 7.5, feedback: 'Clear ideas', source: 'ai' },
      },
      aiDraft: { score: 14.5, feedback: 'Nice work' },
    });
  });

  it('refuses a score above the question’s points or a missing open question', () => {
    expect(
      recordAiScores(assignment, submitted.value, {
        scores: { q3: { score: 6, feedback: '' }, q4: { score: 1, feedback: '' } },
        feedback: '',
      }),
    ).toEqual({ ok: false, error: { field: 'q3', code: 'out_of_range' } });
    expect(
      recordAiScores(assignment, submitted.value, {
        scores: { q3: { score: 1, feedback: '' } },
        feedback: '',
      }),
    ).toEqual({ ok: false, error: { field: 'q4', code: 'required' } });
  });

  it('never overrides a code-scored question', () => {
    const graded = recordAiScores(assignment, submitted.value, {
      scores: {
        q1: { score: 0, feedback: 'wrong' },
        q3: { score: 1, feedback: '' },
        q4: { score: 1, feedback: '' },
      },
      feedback: '',
    });
    expect(graded.ok && graded.value.questionScores['q1' as QuestionId]?.score).toBe(4);
  });
});
