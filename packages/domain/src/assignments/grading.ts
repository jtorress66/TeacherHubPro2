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
import { autoScore, isOpenQuestion, parseAnswer } from './answers.ts';

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
