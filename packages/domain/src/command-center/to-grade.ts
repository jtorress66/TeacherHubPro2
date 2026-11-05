import type { Assignment } from '../gradebook/assignment.ts';
import type { Grade } from '../gradebook/grade.ts';
import type { StudentId } from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import type { Submission } from '../submissions/submission.ts';

export interface ToGradeItem {
  readonly assignment: Assignment;
  /** Work students handed in that the teacher has not confirmed yet. */
  readonly waiting: number;
  /** Students with no grade on past-due work. */
  readonly ungraded: number;
  readonly overdue: boolean;
}

export const maxToGrade = 10;

/** Overdue work first, then by due date (undated last). */
export const byUrgency = (a: ToGradeItem, b: ToGradeItem): number =>
  Number(b.overdue) - Number(a.overdue) ||
  (a.assignment.dueDate ?? '9999-12-31').localeCompare(b.assignment.dueDate ?? '9999-12-31');

/**
 * What is left to grade, per assignment: handed-in work waiting for confirmation, and past-due
 * work with no grade. Overdue work comes first, then by due date; at most ten.
 */
export function toGrade(input: {
  readonly assignments: readonly Assignment[];
  readonly roster: readonly StudentId[];
  readonly grades: readonly Grade[];
  readonly submissions: readonly Pick<Submission, 'assignmentId' | 'studentId' | 'status'>[];
  readonly today: LocalDate;
}): ToGradeItem[] {
  return input.assignments
    .map((assignment) => {
      const graded = new Set(
        input.grades.filter((g) => g.assignmentId === assignment.id).map((g) => g.studentId),
      );
      const waiting = input.submissions.filter(
        (s) => s.assignmentId === assignment.id && s.status !== 'confirmed',
      ).length;
      const overdue = assignment.dueDate !== null && assignment.dueDate < input.today;
      const ungraded = overdue ? input.roster.filter((id) => !graded.has(id)).length : 0;
      return { assignment, waiting, ungraded, overdue };
    })
    .filter((item) => item.waiting + item.ungraded > 0)
    .sort(byUrgency)
    .slice(0, maxToGrade);
}
