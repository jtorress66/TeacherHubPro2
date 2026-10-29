import { describe, expect, it } from 'vitest';
import { type GradeCategoryId } from '../shared/ids.ts';
import {
  assignmentPercentage,
  categoryAverages,
  countedPoints,
  overallPercentage,
  type GradeLine,
} from './grade-calculations.ts';
import { gpaFromPercentage } from './gpa.ts';

const tests = 'tests' as GradeCategoryId;
const homework = 'homework' as GradeCategoryId;
const projects = 'projects' as GradeCategoryId;

const graded = (categoryId: GradeCategoryId, score: number, maxPoints: number): GradeLine => ({
  categoryId,
  maxPoints,
  status: 'graded',
  score,
});

describe('countedPoints', () => {
  it('graded and late count with their score; missing counts as 0', () => {
    expect(countedPoints(graded(tests, 8, 10))).toEqual({ earned: 8, possible: 10 });
    expect(countedPoints({ categoryId: tests, maxPoints: 10, status: 'late', score: 6 })).toEqual({
      earned: 6,
      possible: 10,
    });
    expect(
      countedPoints({ categoryId: tests, maxPoints: 10, status: 'missing', score: null }),
    ).toEqual({
      earned: 0,
      possible: 10,
    });
  });

  it('excused and pending are left out', () => {
    expect(
      countedPoints({ categoryId: tests, maxPoints: 10, status: 'excused', score: null }),
    ).toBeNull();
    expect(
      countedPoints({ categoryId: tests, maxPoints: 10, status: 'pending', score: null }),
    ).toBeNull();
  });

  it('treats a graded line without a score as 0', () => {
    expect(
      countedPoints({ categoryId: tests, maxPoints: 10, status: 'graded', score: null }),
    ).toEqual({
      earned: 0,
      possible: 10,
    });
  });
});

describe('assignmentPercentage', () => {
  it('divides the score by the maximum', () => {
    expect(assignmentPercentage(24, 30)).toBe(80);
  });

  it('is null when the maximum is 0', () => {
    expect(assignmentPercentage(0, 0)).toBeNull();
  });
});

describe('categoryAverages', () => {
  it('sums points within each category, in first-seen order, skipping categories with nothing counted', () => {
    const lines: GradeLine[] = [
      graded(homework, 7, 10),
      graded(tests, 45, 50),
      graded(homework, 9, 10),
      { categoryId: projects, maxPoints: 20, status: 'excused', score: null },
    ];

    expect(categoryAverages(lines)).toEqual([
      { categoryId: homework, earned: 16, possible: 20, percentage: 80 },
      { categoryId: tests, earned: 45, possible: 50, percentage: 90 },
    ]);
  });
});

describe('overallPercentage', () => {
  it('the weighted average rescales over graded categories (recorded example 1)', () => {
    const categories = [
      { id: tests, weightPercent: 50 },
      { id: homework, weightPercent: 30 },
      { id: projects, weightPercent: 20 },
    ];
    const lines = [graded(tests, 45, 50), graded(homework, 7, 10), graded(homework, 9, 10)];

    expect(overallPercentage(categories, lines)).toBeCloseTo(86.25, 10);
  });

  it('excused and pending are left out; missing counts as 0 (recorded example 2)', () => {
    const lines: GradeLine[] = [
      graded(homework, 10, 10),
      { categoryId: homework, maxPoints: 10, status: 'excused', score: null },
      { categoryId: homework, maxPoints: 10, status: 'pending', score: null },
      { categoryId: homework, maxPoints: 10, status: 'missing', score: null },
    ];

    expect(overallPercentage([{ id: homework, weightPercent: 100 }], lines)).toBe(50);
  });

  it('uses the sum of question points as the maximum (recorded example 3)', () => {
    // A 100-point assignment with three 10-point questions: the maximum is 30.
    expect(overallPercentage([{ id: tests, weightPercent: 100 }], [graded(tests, 24, 30)])).toBe(
      80,
    );
  });

  it('with every weight 0, categories count equally', () => {
    const categories = [
      { id: tests, weightPercent: 0 },
      { id: homework, weightPercent: 0 },
    ];
    const lines = [graded(tests, 9, 10), graded(homework, 6, 10)];

    expect(overallPercentage(categories, lines)).toBe(75);
  });

  it('ignores lines whose category is not in the class', () => {
    const lines = [graded(tests, 10, 10), graded('other' as GradeCategoryId, 0, 10)];

    expect(overallPercentage([{ id: tests, weightPercent: 100 }], lines)).toBe(100);
  });

  it('nothing to count gives null', () => {
    expect(overallPercentage([{ id: tests, weightPercent: 100 }], [])).toBeNull();
    expect(
      overallPercentage(
        [{ id: tests, weightPercent: 100 }],
        [{ categoryId: tests, maxPoints: 10, status: 'excused', score: null }],
      ),
    ).toBeNull();
  });
});

describe('gpaFromPercentage (4.0 scale of the original app)', () => {
  it.each([
    [100, 4],
    [95, 4],
    [90, 4],
    [85, 3.5],
    [80, 3],
    [75, 2.5],
    [70, 2],
    [65, 1.5],
    [60, 1],
    [30, 0.5],
    [0, 0],
  ])('%d%% gives %d', (percentage, gpa) => {
    expect(gpaFromPercentage(percentage)).toBeCloseTo(gpa, 10);
  });

  it('recorded example 1 (86.25%) gives 3.625', () => {
    expect(gpaFromPercentage(86.25)).toBeCloseTo(3.625, 10);
  });
});
