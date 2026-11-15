import { describe, expect, it } from 'vitest';
import type { AssignmentId, GradeId, SchoolId, StudentId, UserId } from '../shared/ids.ts';
import type { Grade } from '../gradebook/grade.ts';
import {
  canSendGrades,
  confirmedScore,
  gradeServiceOf,
  ltiAgsScope,
  matchingLineItem,
  newLineItem,
  planGradeSend,
} from './lti-grades.ts';

const lineItems = 'https://lms.example.edu/api/lti/courses/9/line_items';

const grade = (overrides: Partial<Grade> = {}): Grade => ({
  id: 'g1' as GradeId,
  schoolId: 'school-1' as SchoolId,
  studentId: 's1' as StudentId,
  assignmentId: 'a1' as AssignmentId,
  status: 'graded',
  score: 8,
  source: 'manual',
  gradedBy: 'teacher-1' as UserId,
  comment: null,
  ...overrides,
});

describe('gradeServiceOf', () => {
  it('reads the gradebook addresses and the scopes the course system granted', () => {
    expect(
      gradeServiceOf({
        scope: [ltiAgsScope.lineItem, ltiAgsScope.score, 'https://other.example/scope'],
        lineitems: lineItems,
        lineitem: `${lineItems}/31`,
      }),
    ).toEqual({
      lineItemsUrl: lineItems,
      lineItemUrl: `${lineItems}/31`,
      scopes: [ltiAgsScope.lineItem, ltiAgsScope.score],
    });
  });

  it('leaves out an address that is missing, not https, or not an address', () => {
    expect(
      gradeServiceOf({
        scope: [ltiAgsScope.score],
        lineitems: 'http://lms.example.edu/line_items',
        lineitem: 'not an address',
      }),
    ).toEqual({ lineItemsUrl: null, lineItemUrl: null, scopes: [ltiAgsScope.score] });
    expect(gradeServiceOf({ scope: 'oops', lineitems: lineItems })).toEqual({
      lineItemsUrl: lineItems,
      lineItemUrl: null,
      scopes: [],
    });
  });

  it('is null when the course system offers no gradebook', () => {
    expect(gradeServiceOf(undefined)).toBeNull();
    expect(gradeServiceOf(['lineitems'])).toBeNull();
    expect(gradeServiceOf({ scope: [ltiAgsScope.score] })).toBeNull();
  });
});

describe('canSendGrades', () => {
  it('needs the line items address and both the line item and score scopes', () => {
    const scopes = [ltiAgsScope.lineItem, ltiAgsScope.score];
    expect(canSendGrades({ lineItemsUrl: lineItems, gradeScopes: scopes })).toBe(true);
    expect(canSendGrades({ lineItemsUrl: null, gradeScopes: scopes })).toBe(false);
    expect(canSendGrades({ lineItemsUrl: lineItems, gradeScopes: [ltiAgsScope.score] })).toBe(
      false,
    );
    expect(canSendGrades({ lineItemsUrl: lineItems, gradeScopes: [ltiAgsScope.lineItem] })).toBe(
      false,
    );
  });
});

describe('confirmedScore', () => {
  it('is the score of a grade the teacher gave, on time or late', () => {
    expect(confirmedScore(grade())).toBe(8);
    expect(confirmedScore(grade({ status: 'late', score: 6 }))).toBe(6);
  });

  it('is null without a grade, or for a grade with no score', () => {
    expect(confirmedScore(null)).toBeNull();
    for (const status of ['pending', 'missing', 'excused'] as const) {
      expect(confirmedScore(grade({ status, score: null }))).toBeNull();
    }
  });
});

describe('newLineItem', () => {
  it('names the assignment by its id, its title and its points', () => {
    expect(newLineItem({ id: 'a1' as AssignmentId, title: 'Space quiz', maxPoints: 20 })).toEqual({
      scoreMaximum: 20,
      label: 'Space quiz',
      resourceId: 'a1',
      tag: 'teacherhubpro',
    });
  });

  it('shortens a very long title', () => {
    const item = newLineItem({ id: 'a1' as AssignmentId, title: 'x'.repeat(400), maxPoints: 5 });
    expect(item.label).toHaveLength(255);
  });
});

describe('matchingLineItem', () => {
  const ours = { id: `${lineItems}/7`, resourceId: 'a1', label: 'Space quiz' };

  it('finds the line item made for the assignment', () => {
    const items = [{ id: `${lineItems}/6`, resourceId: 'a2' }, ours];
    expect(matchingLineItem(items, 'a1', lineItems)).toBe(`${lineItems}/7`);
  });

  it('ignores line items of other assignments, malformed ones and ones on another site', () => {
    expect(matchingLineItem([{ id: `${lineItems}/6`, resourceId: 'a2' }], 'a1', lineItems)).toBe(
      null,
    );
    expect(matchingLineItem([null, 'x', { resourceId: 'a1' }], 'a1', lineItems)).toBeNull();
    expect(
      matchingLineItem([{ id: 'https://evil.example/7', resourceId: 'a1' }], 'a1', lineItems),
    ).toBeNull();
    expect(matchingLineItem({ items: [ours] }, 'a1', lineItems)).toBeNull();
  });
});

describe('planGradeSend', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const ana = 's1' as StudentId;
  const ben = 's2' as StudentId;
  const cam = 's3' as StudentId;
  const dee = 's4' as StudentId;

  it('sends only confirmed grades of students linked to the course, and counts the rest', () => {
    const plan = planGradeSend({
      studentIds: [ana, ben, cam, dee],
      subjects: new Map([
        [ana, 'lms-ana'],
        [ben, 'lms-ben'],
        [dee, 'lms-dee'],
      ]),
      grades: new Map([
        [ana, grade({ studentId: ana, score: 9 })],
        [ben, grade({ studentId: ben, status: 'pending', score: null })],
        [cam, grade({ studentId: cam, score: 7 })],
      ]),
      maxPoints: 10,
      now,
    });

    expect(plan).toEqual({
      scores: [
        {
          userId: 'lms-ana',
          scoreGiven: 9,
          scoreMaximum: 10,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          timestamp: '2026-11-14T12:00:00.000Z',
        },
      ],
      notConfirmed: 2,
      notLinked: 1,
    });
  });
});
