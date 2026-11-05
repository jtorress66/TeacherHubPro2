import { describe, expect, it } from 'vitest';
import type { InsightRequest } from '@thp/ports';
import { scoreInsight } from './insight-scorecard.ts';

const request: InsightRequest = {
  language: 'en',
  stats: {
    average: 62,
    attendanceRate: 90,
    absences: 1,
    tardies: 0,
    excused: 0,
    sessions: 10,
    missing: 3,
  },
  recentGrades: [],
  recentAttendance: [],
};

describe('scoreInsight', () => {
  it('scores a grounded insight with the expected focus fully', () => {
    const bullets = ['Average is 62%.', 'Three missing assignments.', 'Set a catch-up plan.'];
    expect(scoreInsight({ mentions: ['missing'] }, bullets, request)).toEqual({
      structure: 1,
      count: 1,
      grounded: 1,
      focus: 1,
    });
  });

  it('scores nothing without bullets, and marks down invented numbers, wrong counts and a missed focus', () => {
    expect(scoreInsight({ mentions: [] }, null, request)).toEqual({
      structure: 0,
      count: 0,
      grounded: 0,
      focus: 0,
    });
    expect(scoreInsight({ mentions: ['missing'] }, ['Average is 99%.'], request)).toEqual({
      structure: 1,
      count: 0,
      grounded: 0,
      focus: 0,
    });
  });
});
