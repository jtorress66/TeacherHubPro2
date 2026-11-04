import { describe, expect, it } from 'vitest';
import type { LearningPathId, LessonAttemptId, SchoolId, StudentId } from '../shared/ids.ts';
import type { LearningLesson, LearningPath } from './learning-path.ts';
import { focusOf, nextLevel, startingLevel } from './adaptive-level.ts';
import { scoreCheck, type LessonAttempt } from './lesson-attempt.ts';
import { pathProgress, studentLearningProgress } from './learning-progress.ts';

const lesson = (objective: string): LearningLesson => ({
  title: `About ${objective}`,
  objective,
  minutes: 10,
  content: 'Read this.',
  checks: [
    { prompt: 'One?', options: ['a', 'b', 'c'], answer: 0 },
    { prompt: 'Two?', options: ['a', 'b'], answer: 1 },
    { prompt: 'Three?', options: ['a', 'b'], answer: 1 },
    { prompt: 'Four?', options: ['a', 'b'], answer: 0 },
  ],
});

const path = (overrides: Partial<LearningPath> = {}): LearningPath => ({
  id: 'path-1' as LearningPathId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'teacher-1' as never,
  studentId: 'student-1' as StudentId,
  classId: 'class-1' as never,
  subject: 'math',
  grade: '4',
  language: 'en',
  level: 3,
  title: 'Fractions',
  description: '',
  lessons: [lesson('Compare'), lesson('Order'), lesson('Add')],
  status: 'assigned',
  createdAt: new Date('2026-11-01T10:00:00Z'),
  assignedAt: new Date('2026-11-01T11:00:00Z'),
  ...overrides,
});

const attempt = (
  lessonIndex: number,
  score: number,
  overrides: Partial<LessonAttempt> = {},
): LessonAttempt => ({
  id: `attempt-${String(lessonIndex)}-${String(score)}` as LessonAttemptId,
  schoolId: 'school-1' as SchoolId,
  pathId: 'path-1' as LearningPathId,
  studentId: 'student-1' as StudentId,
  lesson: lessonIndex,
  answers: [],
  score,
  total: 4,
  at: new Date(`2026-11-0${String(2 + lessonIndex)}T10:00:00Z`),
  ...overrides,
});

describe('scoreCheck', () => {
  it('scores on the server and says what the right answers were', () => {
    expect(scoreCheck(lesson('Compare'), [0, 0, 1, 0])).toEqual({
      score: 3,
      total: 4,
      answers: [0, 0, 1, 0],
      corrections: [{ check: 1, answer: 1, right: 'b' }],
    });
  });

  it('counts missing, out-of-range and malformed answers as wrong, and never throws', () => {
    const result = scoreCheck(lesson('Compare'), [0, 7, 'x', null, 1]);
    expect(result).toMatchObject({ score: 1, total: 4, answers: [0, null, null, null] });
    expect(result.corrections.map((c) => c.check)).toEqual([1, 2, 3]);
  });
});

describe('nextLevel', () => {
  it('moves up at 85%, down under 60%, otherwise stays', () => {
    expect(nextLevel(3, [85])).toBe(4);
    expect(nextLevel(3, [84])).toBe(3);
    expect(nextLevel(3, [60])).toBe(3);
    expect(nextLevel(3, [59])).toBe(2);
    expect(nextLevel(3, [100, 50])).toBe(3);
  });

  it('stays between 1 and 5, and without scores keeps the level', () => {
    expect(nextLevel(5, [100])).toBe(5);
    expect(nextLevel(1, [0])).toBe(1);
    expect(nextLevel(2, [])).toBe(2);
  });
});

describe('startingLevel', () => {
  it('starts on grade level, then follows the latest path and its scores', () => {
    expect(startingLevel([], [])).toBe(3);
    const older = path({
      id: 'old' as LearningPathId,
      level: 1,
      createdAt: new Date('2026-10-01'),
    });
    const scores = [attempt(0, 4), attempt(1, 4)];
    expect(startingLevel([older, path()], scores)).toBe(4);
  });
});

describe('focusOf', () => {
  it('lists objectives to review (under 60%) and mastered ones (85%+), by best attempt', () => {
    const attempts = [attempt(0, 1), attempt(1, 4), attempt(2, 1), attempt(2, 3)];
    expect(focusOf([path()], attempts)).toEqual({ review: ['Compare'], mastered: ['Order'] });
  });
});

describe('progress', () => {
  it('counts each lesson once, by its best attempt, and never passes 100%', () => {
    const attempts = [attempt(0, 2), attempt(0, 4), attempt(1, 3), attempt(9, 4)];
    expect(pathProgress(path(), attempts)).toEqual({
      done: 2,
      total: 3,
      percent: 67,
      average: 88,
      lessons: [
        { done: true, best: 100, attempts: 2 },
        { done: true, best: 75, attempts: 1 },
        { done: false, best: null, attempts: 0 },
      ],
      lastActivity: new Date('2026-11-03T10:00:00Z'),
    });
  });

  it('sums a student’s assigned and archived paths per subject, leaving drafts out', () => {
    const draft = path({ id: 'draft' as LearningPathId, status: 'draft' });
    const science = path({ id: 'sci' as LearningPathId, subject: 'science', level: 2 });
    const progress = studentLearningProgress([path(), draft, science], [attempt(0, 4)]);
    expect(progress).toEqual([
      expect.objectContaining({ subject: 'math', done: 1, total: 3, average: 100, level: 3 }),
      expect.objectContaining({ subject: 'science', done: 0, total: 3, average: null, level: 2 }),
    ]);
  });
});
