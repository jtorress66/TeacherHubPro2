import type { AssignmentId } from '../shared/ids.ts';
import { maxPoints, type Assignment } from './assignment.ts';
import { gpaFromPercentage } from './gpa.ts';
import {
  categoryAverages,
  countedPoints,
  overallPercentage,
  type CategoryAverage,
  type GradeLine,
  type WeightedCategory,
} from './grade-calculations.ts';
import type { Grade } from './grade.ts';
import { letterGrade, type LetterGrade } from './letter-grade.ts';

export interface CategoryResult extends CategoryAverage {
  /** Grades that counted in this category. */
  readonly count: number;
}

export interface StudentGradeSummary {
  /** Categories with counted grades, in the class's category order. */
  readonly categories: readonly CategoryResult[];
  readonly overall: number | null;
  readonly gpa: number | null;
  readonly letter: LetterGrade | null;
  /** Points over every counted grade, unweighted. */
  readonly earned: number;
  readonly possible: number;
  /** Assignments with a score (graded or late). */
  readonly completed: number;
}

const scored = (grade: Grade): boolean => grade.status === 'graded' || grade.status === 'late';

/** One student's grades as lines, skipping grades for assignments not listed. */
function gradeLines(assignments: readonly Assignment[], grades: readonly Grade[]): GradeLine[] {
  const byId = new Map<AssignmentId, Assignment>(assignments.map((a) => [a.id, a]));
  return grades.flatMap((grade) => {
    const assignment = byId.get(grade.assignmentId);
    return assignment
      ? [
          {
            categoryId: assignment.categoryId,
            maxPoints: maxPoints(assignment),
            status: grade.status,
            score: grade.score,
          },
        ]
      : [];
  });
}

/** Category averages, the weighted overall, GPA and letter for one student's grades. */
export function studentGradeSummary(
  categories: readonly WeightedCategory[],
  assignments: readonly Assignment[],
  grades: readonly Grade[],
): StudentGradeSummary {
  const lines = gradeLines(assignments, grades);
  const counted = lines.flatMap((line) => {
    const points = countedPoints(line);
    return points ? [{ categoryId: line.categoryId, ...points }] : [];
  });
  const averages = new Map(categoryAverages(lines).map((a) => [a.categoryId, a]));
  const overall = overallPercentage(categories, lines);
  const known = new Set(assignments.map((a) => a.id));

  return {
    categories: categories.flatMap(({ id }) => {
      const average = averages.get(id);
      const count = counted.filter((c) => c.categoryId === id).length;
      return average ? [{ ...average, count }] : [];
    }),
    overall,
    gpa: overall === null ? null : gpaFromPercentage(overall),
    letter: overall === null ? null : letterGrade(overall),
    earned: counted.reduce((sum, c) => sum + c.earned, 0),
    possible: counted.reduce((sum, c) => sum + c.possible, 0),
    completed: grades.filter((grade) => known.has(grade.assignmentId) && scored(grade)).length,
  };
}
