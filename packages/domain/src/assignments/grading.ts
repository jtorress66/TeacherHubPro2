import { maxPoints, type Assignment } from '../gradebook/assignment.ts';
import type { Question } from '../gradebook/question.ts';
import type { QuestionId, StudentId, SubmissionId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import {
  createSubmission,
  recordAiGrade,
  type QuestionScore,
  type Submission,
  type SubmissionError,
} from '../submissions/submission.ts';
import type { Language } from '../shared/language.ts';
import { autoScore, isOpenQuestion, parseAnswer } from './answers.ts';
import { leniencyFor, type Leniency } from './leniency.ts';

export interface StudentAnswers {
  readonly id: SubmissionId;
  readonly assignment: Assignment;
  /** The roster student behind the link; never a typed name. */
  readonly studentId: StudentId;
  readonly answers: Readonly<Record<string, string>>;
  readonly submittedAt: Date;
}

const round = (value: number) => Math.round(value * 100) / 100;
const total = (scores: Readonly<Record<string, QuestionScore>>) =>
  round(Object.values(scores).reduce((sum, s) => sum + s.score, 0));

/** Submitted after the end of the due date (UTC). */
const isLate = (assignment: Assignment, at: Date) =>
  assignment.dueDate !== null && at.getTime() >= Date.parse(`${assignment.dueDate}T23:59:59.999Z`);

/** Open questions the student answered that still need a score. */
export const pendingOpenQuestions = (assignment: Assignment, submission: Submission): Question[] =>
  assignment.questions.filter(
    (question) =>
      isOpenQuestion(question) &&
      submission.answers[question.id] !== undefined &&
      submission.questionScores[question.id] === undefined,
  );

/** With every question scored, the total becomes the draft the teacher confirms. */
function draftIfComplete(
  assignment: Assignment,
  submission: Submission,
  feedback: string,
): Result<Submission, SubmissionError> {
  if (pendingOpenQuestions(assignment, submission).length > 0) return ok(submission);
  return recordAiGrade(submission, { score: total(submission.questionScores), feedback });
}

/**
 * A student's submission: every answer checked for its question, objective questions scored by
 * code at once, and unanswered questions scored 0. Open answers wait for the AI or the teacher.
 */
export function submitAnswers(input: StudentAnswers): Result<Submission, SubmissionError> {
  const { assignment } = input;
  if (assignment.questions.length === 0) return invalid('questions', 'required');
  const known = new Set<string>(assignment.questions.map((question) => question.id));
  const unknown = Object.keys(input.answers).find((id) => !known.has(id));
  if (unknown !== undefined) return invalid(unknown, 'not_allowed');

  const answers: Record<QuestionId, string> = {};
  const scores: Record<QuestionId, QuestionScore> = {};
  for (const question of assignment.questions) {
    const answer = parseAnswer(question, input.answers[question.id]);
    if (!answer.ok) return answer;
    if (answer.value !== null) answers[question.id] = answer.value;
    const score = answer.value === null ? 0 : autoScore(question, answer.value);
    if (score !== null) scores[question.id] = { score, feedback: null, source: 'auto' };
  }

  const submission = createSubmission({
    id: input.id,
    schoolId: assignment.schoolId,
    assignmentId: assignment.id,
    studentId: input.studentId,
    answers,
    submittedAt: input.submittedAt,
    maxPoints: maxPoints(assignment),
    late: isLate(assignment, input.submittedAt),
    questionScores: scores,
  });
  if (!submission.ok) return submission;
  return draftIfComplete(assignment, submission.value, '');
}

export interface AiScores {
  readonly scores: Readonly<Record<string, { readonly score: number; readonly feedback: string }>>;
  readonly feedback: string;
}

/**
 * The AI's suggestions for the open answers. Each must be within the question's points, and
 * code-scored questions keep their score. The total is a draft until the teacher confirms it.
 */
export function recordAiScores(
  assignment: Assignment,
  submission: Submission,
  ai: AiScores,
): Result<Submission, SubmissionError> {
  const scores: Record<QuestionId, QuestionScore> = { ...submission.questionScores };
  for (const question of pendingOpenQuestions(assignment, submission)) {
    const suggestion = ai.scores[question.id];
    if (suggestion === undefined) return invalid(question.id, 'required');
    if (!(suggestion.score >= 0 && suggestion.score <= question.points)) {
      return invalid(question.id, 'out_of_range');
    }
    scores[question.id] = { score: suggestion.score, feedback: suggestion.feedback, source: 'ai' };
  }
  return draftIfComplete(assignment, { ...submission, questionScores: scores }, ai.feedback);
}

/** One open answer for the AI to judge: the question, its guide and the answer, nothing else. */
export interface AnswerToGrade {
  readonly id: QuestionId;
  readonly type: 'short_answer' | 'essay';
  readonly prompt: string;
  readonly points: number;
  /** The model answer or rubric, when the teacher wrote one. */
  readonly guide: string | null;
  readonly answer: string;
}

/** What the grader is sent: no names, ids or other student data. */
export interface GradingRequest {
  readonly language: Language;
  readonly leniency: Leniency;
  readonly questions: readonly AnswerToGrade[];
}

const guideOf = (question: Question): string | null => {
  if (question.type === 'short_answer') return question.modelAnswer;
  if (question.type === 'essay') return question.rubric;
  return null;
};

export function gradingRequest(
  assignment: Assignment,
  submission: Submission,
  context: { readonly grade: string | null; readonly language: Language },
): GradingRequest {
  return {
    language: context.language,
    leniency: leniencyFor(context.grade),
    questions: pendingOpenQuestions(assignment, submission).map((question) => ({
      id: question.id,
      type: question.type as AnswerToGrade['type'],
      prompt: question.prompt,
      points: question.points,
      guide: guideOf(question),
      answer: submission.answers[question.id] ?? '',
    })),
  };
}
