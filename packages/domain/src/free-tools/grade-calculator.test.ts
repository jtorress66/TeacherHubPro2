import { describe, expect, it } from 'vitest';
import { calculateGrade, parseScores } from './grade-calculator.ts';

const points = (earned: number, possible = 100) => ({ earned, possible });

describe('calculateGrade', () => {
  it('weights each category average and gives the letter and GPA', () => {
    const result = calculateGrade([
      { weightPercent: 25, scores: [points(90), points(80)] }, // 85
      { weightPercent: 25, scores: [points(18, 20)] }, // 90
      { weightPercent: 50, scores: [points(70)] }, // 70
    ]);

    expect(result).toEqual({
      percentage: 78.75,
      letter: 'C',
      gpa: 2.875,
      categories: [85, 90, 70],
      weightTotal: 100,
    });
  });

  it('rescales over the categories that have scores, as the gradebook does', () => {
    const result = calculateGrade([
      { weightPercent: 40, scores: [points(95)] },
      { weightPercent: 60, scores: [] },
    ]);

    expect(result).toMatchObject({ percentage: 95, letter: 'A', gpa: 4, categories: [95, null] });
    expect(result?.weightTotal).toBe(100);
  });

  it('counts categories equally when every weight is 0', () => {
    expect(
      calculateGrade([
        { weightPercent: 0, scores: [points(80)] },
        { weightPercent: 0, scores: [points(60)] },
      ])?.percentage,
    ).toBe(70);
  });

  it('reports weights that do not add up to 100', () => {
    expect(
      calculateGrade([
        { weightPercent: 30, scores: [points(80)] },
        { weightPercent: 30, scores: [points(90)] },
      ])?.weightTotal,
    ).toBe(60);
  });

  it('ignores scores with nothing possible and refuses impossible numbers', () => {
    expect(calculateGrade([{ weightPercent: 100, scores: [points(5, 0)] }])).toBeNull();
    expect(
      calculateGrade([{ weightPercent: 100, scores: [points(-1), points(80)] }])?.percentage,
    ).toBe(80);
    expect(calculateGrade([{ weightPercent: -5, scores: [points(80)] }])).toBeNull();
  });

  it('is empty with no scores at all', () => {
    expect(calculateGrade([])).toBeNull();
    expect(calculateGrade([{ weightPercent: 100, scores: [] }])).toBeNull();
  });
});

describe('parseScores', () => {
  it('reads "18/20", "85" and "85%" as points, one per line or comma', () => {
    expect(parseScores('18/20\n85, 92%\n  7 / 10 ')).toEqual({
      scores: [points(18, 20), points(85), points(92), points(7, 10)],
      unread: 0,
    });
  });

  it('counts what it cannot read instead of guessing', () => {
    expect(parseScores('A+\n90\n5/0\n-3\n\n')).toEqual({ scores: [points(90)], unread: 3 });
  });

  it('accepts a decimal comma', () => {
    expect(parseScores('8,5/10')).toEqual({ scores: [points(8.5, 10)], unread: 0 });
  });
});
