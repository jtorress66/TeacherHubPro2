import { describe, expect, it } from 'vitest';
import type { ClassId, LearningPathId, SchoolId, StudentId, UserId } from '../shared/ids.ts';
import {
  archivePath,
  assignPath,
  createLearningPath,
  editPath,
  learnerLesson,
  validatePathDraft,
  type LearningLesson,
  type LearningPathInput,
} from './learning-path.ts';
import { createPathRequest } from './path-request.ts';

const now = new Date('2026-11-04T10:00:00Z');

const lesson = (n: number, overrides: Partial<LearningLesson> = {}): LearningLesson => ({
  title: `Fractions part ${String(n)}`,
  objective: `Compare fractions with like denominators (${String(n)})`,
  minutes: 15,
  content: 'A fraction names part of a whole. When the bottom numbers match, compare the tops.',
  checks: [
    { prompt: `Which is larger, 3/8 or 5/8? (${String(n)})`, options: ['3/8', '5/8'], answer: 1 },
    { prompt: `Which is smaller, 1/4 or 3/4? (${String(n)})`, options: ['1/4', '3/4'], answer: 0 },
    { prompt: `Is 2/6 equal to 2/6? (${String(n)})`, options: ['Yes', 'No'], answer: 0 },
  ],
  ...overrides,
});

const input = (overrides: Partial<LearningPathInput> = {}): LearningPathInput => ({
  id: 'path-1' as LearningPathId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'teacher-1' as UserId,
  studentId: 'student-1' as StudentId,
  classId: 'class-1' as ClassId,
  subject: 'math',
  grade: '4',
  language: 'en',
  level: 3,
  title: 'Fractions, step by step',
  description: 'Comparing and ordering fractions.',
  lessons: [lesson(1), lesson(2), lesson(3)],
  createdAt: now,
  ...overrides,
});

describe('createLearningPath', () => {
  it('starts as a draft the teacher reviews', () => {
    const path = createLearningPath(input());
    expect(path.ok && path.value).toMatchObject({ status: 'draft', assignedAt: null, level: 3 });
  });

  it('needs 3 to 8 lessons', () => {
    expect(createLearningPath(input({ lessons: [lesson(1), lesson(2)] }))).toMatchObject({
      ok: false,
      error: { field: 'lessons', code: 'too_short' },
    });
    const nine = Array.from({ length: 9 }, (_, i) => lesson(i));
    expect(createLearningPath(input({ lessons: nine }))).toMatchObject({
      ok: false,
      error: { field: 'lessons', code: 'too_long' },
    });
  });

  it('checks each lesson: placeholders, minutes, and an answer among the options', () => {
    expect(
      createLearningPath(input({ lessons: [lesson(1, { title: 'TODO' }), lesson(2), lesson(3)] })),
    ).toMatchObject({ ok: false, error: { field: 'lessons.0.title', code: 'not_allowed' } });
    expect(
      createLearningPath(input({ lessons: [lesson(1), lesson(2, { minutes: 90 }), lesson(3)] })),
    ).toMatchObject({ ok: false, error: { field: 'lessons.1.minutes', code: 'out_of_range' } });
    const badCheck = lesson(3, {
      checks: [
        ...lesson(3).checks.slice(0, 2),
        { prompt: 'Which is larger?', options: ['1/2', '2/2'], answer: 2 },
      ],
    });
    expect(createLearningPath(input({ lessons: [lesson(1), lesson(2), badCheck] }))).toMatchObject({
      ok: false,
      error: { field: 'lessons.2.checks.2.answer', code: 'out_of_range' },
    });
  });

  it('needs 3 to 6 check questions per lesson', () => {
    const short = lesson(1, { checks: lesson(1).checks.slice(0, 2) });
    expect(createLearningPath(input({ lessons: [short, lesson(2), lesson(3)] }))).toMatchObject({
      ok: false,
      error: { field: 'lessons.0.checks', code: 'too_short' },
    });
  });

  it('refuses an unknown subject, grade, language or level', () => {
    expect(createLearningPath(input({ subject: 'alchemy' })).ok).toBe(false);
    expect(createLearningPath(input({ grade: '13' })).ok).toBe(false);
    expect(createLearningPath(input({ language: 'xx' })).ok).toBe(false);
    expect(createLearningPath(input({ level: 6 })).ok).toBe(false);
  });
});

describe('the path lifecycle', () => {
  const draft = () => {
    const path = createLearningPath(input());
    if (!path.ok) throw new Error('fixture');
    return path.value;
  };

  it('a draft can be edited, then assigned; an assigned path is no longer edited', () => {
    const edited = editPath(draft(), {
      title: 'Fractions',
      lessons: [lesson(1), lesson(2), lesson(4)],
    });
    expect(edited.ok && edited.value.title).toBe('Fractions');
    const assigned = assignPath(draft(), now);
    expect(assigned.ok && assigned.value).toMatchObject({ status: 'assigned', assignedAt: now });
    if (!assigned.ok) return;
    expect(editPath(assigned.value, { title: 'Again' })).toMatchObject({
      ok: false,
      error: { field: 'status', code: 'not_allowed' },
    });
    expect(assignPath(assigned.value, now).ok).toBe(false);
  });

  it('an edit is checked like a new path', () => {
    expect(editPath(draft(), { lessons: [lesson(1)] })).toMatchObject({
      ok: false,
      error: { field: 'lessons', code: 'too_short' },
    });
  });

  it('archiving takes a path off the student link; a draft cannot be archived', () => {
    const assigned = assignPath(draft(), now);
    if (!assigned.ok) throw new Error('fixture');
    expect(archivePath(assigned.value)).toMatchObject({ ok: true, value: { status: 'archived' } });
    expect(archivePath(draft()).ok).toBe(false);
  });
});

describe('learnerLesson', () => {
  it('shows the student everything but the answers', () => {
    const view = learnerLesson(lesson(1));
    expect(view.checks[0]).toEqual({
      prompt: 'Which is larger, 3/8 or 5/8? (1)',
      options: ['3/8', '5/8'],
    });
    expect(JSON.stringify(view)).not.toContain('answer');
  });
});

describe('createPathRequest', () => {
  const request = {
    subject: 'math',
    grade: '4',
    language: 'es',
    level: 3,
    lessonCount: 5,
    topic: ' Fractions ',
    review: ['Compare fractions'],
    mastered: [],
  };

  it('keeps what the writer needs, and no student data', () => {
    expect(createPathRequest(request)).toEqual({
      ok: true,
      value: {
        subject: 'math',
        grade: '4',
        language: 'es',
        level: 3,
        lessonCount: 5,
        topic: 'Fractions',
        review: ['Compare fractions'],
        mastered: [],
        esl: false,
      },
    });
  });

  it('writes for English learners only when the ESL switch is on', () => {
    const esl = createPathRequest({ ...request, esl: true });

    expect(esl.ok && esl.value.esl).toBe(true);
  });

  it('a blank topic lets the writer choose; counts and levels stay in range', () => {
    expect(createPathRequest({ ...request, topic: '  ' })).toMatchObject({
      ok: true,
      value: { topic: null },
    });
    expect(createPathRequest({ ...request, lessonCount: 9 })).toMatchObject({
      ok: false,
      error: { field: 'lessonCount', code: 'out_of_range' },
    });
    expect(createPathRequest({ ...request, level: 0 }).ok).toBe(false);
    expect(createPathRequest({ ...request, subject: 'alchemy' }).ok).toBe(false);
  });

  it('caps the focus lists so the prompt stays short', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Objective ${String(i)}`);
    const capped = createPathRequest({ ...request, review: many, mastered: many });
    expect(capped.ok && capped.value.review).toHaveLength(8);
    expect(capped.ok && capped.value.mastered).toHaveLength(8);
  });
});

describe('validatePathDraft', () => {
  it('checks what the writer returns with the same rules, and trims it', () => {
    const draft = {
      title: ' Fractions ',
      description: '',
      lessons: [lesson(1), lesson(2), lesson(3)],
    };
    expect(validatePathDraft(draft)).toMatchObject({ ok: true, value: { title: 'Fractions' } });
    expect(validatePathDraft({ ...draft, lessons: [lesson(1)] })).toMatchObject({
      ok: false,
      error: { field: 'lessons', code: 'too_short' },
    });
  });
});
