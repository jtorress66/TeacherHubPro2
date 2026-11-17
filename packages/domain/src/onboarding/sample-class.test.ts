import { describe, expect, it } from 'vitest';
import { riskOf } from '../command-center/at-risk.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { Grade } from '../gradebook/grade.ts';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  GradeId,
  SchoolId,
  StudentId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import {
  sampleAttendance,
  sampleHelpStudent,
  sampleScores,
  sampleSchoolDays,
  sampleStudentCount,
  sampleWeekStart,
} from './sample-class.ts';

const date = (value: string) => value as LocalDate;

describe('sampleSchoolDays', () => {
  it('is the five weekdays before today, oldest first', () => {
    // 2026-11-18 is a Wednesday.
    expect(sampleSchoolDays(date('2026-11-18'))).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-16',
      '2026-11-17',
    ]);
  });

  it('skips the weekend when today is a Monday or a Sunday', () => {
    expect(sampleSchoolDays(date('2026-11-16'))).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
    expect(sampleSchoolDays(date('2026-11-15'))).toEqual(sampleSchoolDays(date('2026-11-16')));
  });
});

describe('sampleWeekStart', () => {
  it("is this week's Monday on a school day", () => {
    expect(sampleWeekStart(date('2026-11-18'))).toBe('2026-11-16');
    expect(sampleWeekStart(date('2026-11-16'))).toBe('2026-11-16');
    expect(sampleWeekStart(date('2026-11-20'))).toBe('2026-11-16');
  });

  it("is next week's Monday on a weekend", () => {
    expect(sampleWeekStart(date('2026-11-21'))).toBe('2026-11-23');
    expect(sampleWeekStart(date('2026-11-22'))).toBe('2026-11-23');
  });
});

describe('the sample roster', () => {
  it('gives every student a mark on every day and a score on every graded assignment', () => {
    expect(sampleAttendance).toHaveLength(5);
    for (const day of sampleAttendance) expect(day).toHaveLength(sampleStudentCount);
    for (const scores of Object.values(sampleScores))
      expect(scores).toHaveLength(sampleStudentCount);
  });

  it('has exactly one student who may need help, from low grades and absences', () => {
    const category = 'cat' as GradeCategoryId;
    const assignment = (id: string): Assignment => ({
      id: id as AssignmentId,
      schoolId: 's1' as SchoolId,
      classId: 'c1' as ClassId,
      categoryId: category,
      title: id,
      points: 100,
      dueDate: date('2026-11-10'),
      instructions: null,
      questions: [],
    });
    const grade = (id: string, score: number | undefined): Grade => ({
      id: `g-${id}` as GradeId,
      schoolId: 's1' as SchoolId,
      studentId: 'st' as StudentId,
      assignmentId: id as AssignmentId,
      status: 'graded',
      score: score ?? null,
      source: 'manual',
      gradedBy: 'u1' as UserId,
      comment: null,
    });
    const risks = Array.from({ length: sampleStudentCount }, (_, student) =>
      riskOf({
        categories: [{ id: category, weightPercent: 100 }],
        assignments: [assignment('hw'), assignment('quiz')],
        grades: [
          grade('hw', sampleScores.homework[student]),
          grade('quiz', sampleScores.quiz[student]),
        ],
        statuses: sampleAttendance.map((day) => day[student] ?? 'present'),
        today: date('2026-11-16'),
      }),
    );

    const flagged = risks.flatMap((risk, student) => (risk.score >= 2 ? [student] : []));
    expect(flagged).toEqual([sampleHelpStudent]);
  });
});
