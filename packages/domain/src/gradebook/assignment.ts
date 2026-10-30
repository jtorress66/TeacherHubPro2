import type { AssignmentId, ClassId, GradeCategoryId, SchoolId } from '../shared/ids.ts';
import { parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import type { Question } from './question.ts';

/** Points for an assignment without questions (as in the original app). */
export const defaultAssignmentPoints = 100;

export interface Assignment {
  readonly id: AssignmentId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly categoryId: GradeCategoryId;
  readonly title: string;
  readonly points: number;
  readonly dueDate: LocalDate | null;
  readonly questions: readonly Question[];
}

export interface AssignmentInput {
  readonly id: AssignmentId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly categoryId: GradeCategoryId;
  readonly title: string;
  readonly points?: number;
  readonly dueDate?: string | null;
  readonly questions?: readonly Question[];
}

export function createAssignment(input: AssignmentInput): Result<Assignment, ValidationError> {
  const title = requiredText('title', input.title);
  if (!title.ok) return title;
  const points = input.points ?? defaultAssignmentPoints;
  if (!(points > 0) || !Number.isFinite(points)) return invalid('points', 'out_of_range');
  let dueDate: LocalDate | null = null;
  if (input.dueDate != null) {
    const parsed = parseLocalDate('dueDate', input.dueDate);
    if (!parsed.ok) return parsed;
    dueDate = parsed.value;
  }
  const questions = input.questions ?? [];
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    return invalid('questions', 'duplicate');
  }

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    classId: input.classId,
    categoryId: input.categoryId,
    title: title.value,
    points,
    dueDate,
    questions,
  });
}

export type AssignmentDetails = Pick<
  AssignmentInput,
  'title' | 'categoryId' | 'points' | 'dueDate'
>;

/** Replaces the editable fields with the same rules as creating; questions are kept. */
export function updateAssignment(
  assignment: Assignment,
  details: AssignmentDetails,
): Result<Assignment, ValidationError> {
  return createAssignment({
    id: assignment.id,
    schoolId: assignment.schoolId,
    classId: assignment.classId,
    questions: assignment.questions,
    ...details,
  });
}

/** The maximum score: the sum of question points, or `points` when there are no questions. */
export function maxPoints(assignment: Pick<Assignment, 'points' | 'questions'>): number {
  if (assignment.questions.length === 0) return assignment.points;
  return assignment.questions.reduce((sum, question) => sum + question.points, 0);
}
