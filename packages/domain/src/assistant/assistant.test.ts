import { describe, expect, it } from 'vitest';
import type { GenerationId, SchoolId, UserId } from '../shared/ids.ts';
import {
  createContentRequest,
  usesStandards,
  type ContentRequestInput,
} from './content-request.ts';
import { createGeneration, maxGenerationLength, removeUnknownCodes } from './generation.ts';

const input = (overrides: Partial<ContentRequestInput> = {}): ContentRequestInput => ({
  type: 'worksheet',
  subject: 'math',
  grade: '4',
  topic: 'Equivalent fractions',
  language: 'en',
  ...overrides,
});

describe('createContentRequest', () => {
  it('fills defaults and keeps only the options the content type uses', () => {
    const request = createContentRequest(input({ questionCount: 12, durationMinutes: 30 }));

    expect(request).toEqual({
      ok: true,
      value: {
        type: 'worksheet',
        subject: 'math',
        grade: '4',
        topic: 'Equivalent fractions',
        difficulty: 'medium',
        durationMinutes: null,
        questionCount: null,
        language: 'en',
        instructions: null,
      },
    });
  });

  it('gives a quiz a question count, 10 by default', () => {
    const quiz = createContentRequest(input({ type: 'quiz' }));
    expect(quiz.ok && quiz.value.questionCount).toBe(10);
    const eight = createContentRequest(input({ type: 'quiz', questionCount: 8 }));
    expect(eight.ok && eight.value.questionCount).toBe(8);
  });

  it('gives lesson plans and activities a duration, 45 minutes by default', () => {
    const plan = createContentRequest(input({ type: 'lesson_plan' }));
    expect(plan.ok && plan.value.durationMinutes).toBe(45);
    const activities = createContentRequest(input({ type: 'activities', durationMinutes: 20 }));
    expect(activities.ok && activities.value.durationMinutes).toBe(20);
  });

  it.each([
    [{ type: 'essay' }, 'type', 'not_allowed'],
    [{ subject: 'astrology' }, 'subject', 'not_allowed'],
    [{ grade: '13' }, 'grade', 'not_allowed'],
    [{ topic: '  ' }, 'topic', 'required'],
    [{ difficulty: 'extreme' }, 'difficulty', 'not_allowed'],
    [{ language: 'ru' }, 'language', 'not_allowed'],
    [{ type: 'quiz', questionCount: 31 }, 'questionCount', 'out_of_range'],
    [{ type: 'quiz', questionCount: 0 }, 'questionCount', 'out_of_range'],
    [{ type: 'lesson_plan', durationMinutes: 5 }, 'durationMinutes', 'out_of_range'],
    [{ instructions: 'x'.repeat(1001) }, 'instructions', 'too_long'],
  ] as const)('rejects %o', (overrides, field, code) => {
    expect(createContentRequest(input(overrides))).toEqual({ ok: false, error: { field, code } });
  });

  it('lists standards only for subjects that have Common Core codes', () => {
    const math = createContentRequest(input());
    const art = createContentRequest(input({ subject: 'art' }));
    expect(math.ok && usesStandards(math.value)).toBe(true);
    expect(art.ok && usesStandards(art.value)).toBe(false);
  });
});

describe('removeUnknownCodes', () => {
  it('keeps official codes and removes invented ones', () => {
    const text =
      'Standards: CCSS.Math.Content.4.NF.A.1, CCSS.Math.Content.4.NF.Z.9 and (CCSS.Fake.1).';
    expect(removeUnknownCodes(text)).toBe('Standards: CCSS.Math.Content.4.NF.A.1, and ().');
  });

  it('leaves text without codes unchanged', () => {
    expect(removeUnknownCodes('# Fractions\n\n- Compare 1/2 and 2/4')).toBe(
      '# Fractions\n\n- Compare 1/2 and 2/4',
    );
  });
});

describe('createGeneration', () => {
  const request = createContentRequest(input());
  if (!request.ok) throw new Error('bad request');
  const base = {
    id: 'gen-1' as GenerationId,
    schoolId: 'school-1' as SchoolId,
    teacherId: 'teacher-1' as UserId,
    request: request.value,
    createdAt: new Date('2026-10-30T12:00:00Z'),
  };

  it('stores the request details with the trimmed content', () => {
    const generation = createGeneration({ ...base, content: '  # Worksheet\n\n1. ___  ' });
    expect(generation).toEqual({
      ok: true,
      value: {
        id: 'gen-1',
        schoolId: 'school-1',
        teacherId: 'teacher-1',
        type: 'worksheet',
        subject: 'math',
        grade: '4',
        topic: 'Equivalent fractions',
        language: 'en',
        content: '# Worksheet\n\n1. ___',
        createdAt: new Date('2026-10-30T12:00:00Z'),
      },
    });
  });

  it('needs content within the length limit', () => {
    expect(createGeneration({ ...base, content: ' ' })).toEqual({
      ok: false,
      error: { field: 'content', code: 'required' },
    });
    expect(createGeneration({ ...base, content: 'x'.repeat(maxGenerationLength + 1) })).toEqual({
      ok: false,
      error: { field: 'content', code: 'too_long' },
    });
  });
});
