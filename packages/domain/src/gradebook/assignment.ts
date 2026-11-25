import type { AssignmentId, ClassId, GradeCategoryId, SchoolId } from '../shared/ids.ts';
import { parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import { typedStandardCodes } from '../lesson-plans/plan-standards.ts';
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
  /** General instructions shown to students above the questions. */
  readonly instructions: string | null;
  readonly questions: readonly Question[];
  /** The standards it tests, as the teacher chose them (Common Core, Puerto Rico or typed). */
  readonly standards: readonly string[];
}

export const maxAssignmentInstructionsLength = 5000;
export const maxAssignmentStandards = 12;

export interface AssignmentInput {
  readonly id: AssignmentId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly categoryId: GradeCategoryId;
  readonly title: string;
  readonly points?: number;
  readonly dueDate?: string | null;
  readonly instructions?: string | null;
  readonly questions?: readonly Question[];
  readonly standards?: readonly string[];
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
  const instructions = optionalText(
    'instructions',
    input.instructions,
    maxAssignmentInstructionsLength,
  );
  if (!instructions.ok) return instructions;
  const questions = input.questions ?? [];
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    return invalid('questions', 'duplicate');
  }
  const standards = typedStandardCodes('standards', input.standards ?? [], maxAssignmentStandards);
  if (!standards.ok) return standards;

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    classId: input.classId,
    categoryId: input.categoryId,
    title: title.value,
    points,
    dueDate,
    instructions: instructions.value,
    questions,
    standards: standards.value,
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
    instructions: assignment.instructions,
    standards: assignment.standards,
    ...details,
  });
}

const rebuild = (assignment: Assignment, changes: Partial<AssignmentInput>) =>
  createAssignment({ ...assignment, ...changes });

/** The question builder saves the whole list at once; ids must stay unique. */
export const replaceQuestions = (
  assignment: Assignment,
  questions: readonly Question[],
): Result<Assignment, ValidationError> => rebuild(assignment, { questions });

export const setInstructions = (
  assignment: Assignment,
  instructions: string | null,
): Result<Assignment, ValidationError> => rebuild(assignment, { instructions });

/** The standards the assignment tests; an empty list clears them. */
export const setAssignmentStandards = (
  assignment: Assignment,
  standards: readonly string[],
): Result<Assignment, ValidationError> => rebuild(assignment, { standards });

/** The maximum score: the sum of question points, or `points` when there are no questions. */
export function maxPoints(assignment: Pick<Assignment, 'points' | 'questions'>): number {
  if (assignment.questions.length === 0) return assignment.points;
  return assignment.questions.reduce((sum, question) => sum + question.points, 0);
}
