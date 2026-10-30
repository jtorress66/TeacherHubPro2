import type { StudentId } from '../shared/ids.ts';
import type { Assignment } from './assignment.ts';
import { gpaFromPercentage } from './gpa.ts';
import type { WeightedCategory } from './grade-calculations.ts';
import type { Grade } from './grade.ts';
import { letterGrade, letterGrades, type LetterGrade } from './letter-grade.ts';
import { studentGradeSummary, type StudentGradeSummary } from './student-grades.ts';

export interface StudentGradeRow {
  readonly studentId: StudentId;
  readonly summary: StudentGradeSummary;
}

export interface ClassGradeReport {
  readonly students: readonly StudentGradeRow[];
  /** The mean of the students' overall grades, over students that have one. */
  readonly average: number | null;
  readonly gpa: number | null;
  readonly letter: LetterGrade | null;
  readonly distribution: Readonly<Record<LetterGrade, number>>;
}

/** Each listed student's summary from the class's grades, with class-wide statistics. */
export function classGradeReport(
  categories: readonly WeightedCategory[],
  assignments: readonly Assignment[],
  grades: readonly Grade[],
  studentIds: readonly StudentId[],
): ClassGradeReport {
  const students = studentIds.map((studentId) => ({
    studentId,
    summary: studentGradeSummary(
      categories,
      assignments,
      grades.filter((grade) => grade.studentId === studentId),
    ),
  }));
  const overalls = students.flatMap(({ summary }) =>
    summary.overall === null ? [] : [summary.overall],
  );
  const distribution = Object.fromEntries(letterGrades.map((letter) => [letter, 0])) as Record<
    LetterGrade,
    number
  >;
  for (const overall of overalls) distribution[letterGrade(overall)] += 1;
  const average =
    overalls.length === 0 ? null : overalls.reduce((sum, o) => sum + o, 0) / overalls.length;

  return {
    students,
    average,
    gpa: average === null ? null : gpaFromPercentage(average),
    letter: average === null ? null : letterGrade(average),
    distribution,
  };
}
