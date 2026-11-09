import { describe, expect, it } from 'vitest';
import type { RubricId, SchoolId, UserId } from '../shared/ids.ts';
import {
  blankRubricDetails,
  createRubric,
  maxRubricPoints,
  rubricAsText,
  updateRubric,
  type RubricDetails,
} from './rubric.ts';
import { createRubricRequest } from './rubric-request.ts';

const details = (overrides: Partial<RubricDetails> = {}): RubricDetails => ({
  title: ' Persuasive essay ',
  subject: 'ela',
  grade: '7',
  levels: [
    { label: 'Excellent', points: 4 },
    { label: 'Good', points: 3 },
    { label: 'Needs work', points: 1 },
  ],
  criteria: [
    { name: 'Thesis', descriptors: ['Clear and arguable', 'Clear', 'Missing'] },
    { name: 'Evidence', descriptors: ['Strong and cited', 'Some', ''] },
  ],
  ...overrides,
});

const now = new Date('2026-11-08T12:00:00Z');
const make = (overrides: Partial<RubricDetails> = {}) =>
  createRubric({
    id: 'rubric-1' as RubricId,
    schoolId: 'school-1' as SchoolId,
    teacherId: 'teacher-1' as UserId,
    ...details(overrides),
    now,
  });

describe('createRubric', () => {
  it('keeps a grid of criteria by levels, trimmed, with its total points', () => {
    const rubric = make();

    expect(rubric).toMatchObject({
      ok: true,
      value: { title: 'Persuasive essay', subject: 'ela', grade: '7', createdAt: now },
    });
    expect(rubric.ok && maxRubricPoints(rubric.value)).toBe(8);
  });

  it('needs a title, 1 to 10 criteria and 2 to 6 levels', () => {
    expect(make({ title: ' ' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(make({ criteria: [] })).toEqual({
      ok: false,
      error: { field: 'criteria', code: 'out_of_range' },
    });
    expect(make({ levels: [{ label: 'Only', points: 1 }] })).toEqual({
      ok: false,
      error: { field: 'levels', code: 'out_of_range' },
    });
  });

  it('needs level points from highest to lowest and one description per level', () => {
    const levels = [
      { label: 'Low', points: 1 },
      { label: 'High', points: 4 },
      { label: 'Mid', points: 2 },
    ];
    expect(make({ levels })).toEqual({
      ok: false,
      error: { field: 'levels', code: 'invalid_order' },
    });
    expect(make({ criteria: [{ name: 'Thesis', descriptors: ['Only one'] }] })).toEqual({
      ok: false,
      error: { field: 'criteria.0.descriptors', code: 'out_of_range' },
    });
    expect(make({ criteria: [{ name: ' ', descriptors: ['a', 'b', 'c'] }] })).toEqual({
      ok: false,
      error: { field: 'criteria.0.name', code: 'required' },
    });
  });

  it('refuses an unknown subject or grade, and leaves them out when blank', () => {
    expect(make({ subject: 'alchemy' }).ok).toBe(false);
    expect(make({ grade: '13' }).ok).toBe(false);
    expect(make({ subject: '', grade: null })).toMatchObject({
      ok: true,
      value: { subject: null, grade: null },
    });
  });
});

describe('updateRubric', () => {
  it('replaces the details and moves the update time', () => {
    const rubric = make();
    if (!rubric.ok) throw new Error('rubric');
    const later = new Date('2026-11-09T12:00:00Z');

    const updated = updateRubric(rubric.value, details({ title: 'Argument' }), later);

    expect(updated).toMatchObject({
      ok: true,
      value: { title: 'Argument', createdAt: now, updatedAt: later },
    });
  });
});

describe('blankRubricDetails', () => {
  it('starts a grid with the counts asked for and points counting down to 1', () => {
    const blank = blankRubricDetails({
      title: 'Lab report',
      criteriaCount: 2,
      levelCount: 3,
      levelLabel: (n) => `Level ${String(n)}`,
      criterionName: (n) => `Criterion ${String(n)}`,
    });

    expect(blank.levels).toEqual([
      { label: 'Level 3', points: 3 },
      { label: 'Level 2', points: 2 },
      { label: 'Level 1', points: 1 },
    ]);
    expect(blank.criteria).toEqual([
      { name: 'Criterion 1', descriptors: ['', '', ''] },
      { name: 'Criterion 2', descriptors: ['', '', ''] },
    ]);
  });
});

describe('rubricAsText', () => {
  it('writes each criterion with its levels for an essay question', () => {
    const rubric = make();
    if (!rubric.ok) throw new Error('rubric');

    expect(rubricAsText(rubric.value)).toBe(
      [
        'Thesis: Excellent (4) Clear and arguable; Good (3) Clear; Needs work (1) Missing',
        'Evidence: Excellent (4) Strong and cited; Good (3) Some; Needs work (1)',
      ].join('\n'),
    );
  });
});

describe('createRubricRequest', () => {
  const input = { topic: 'Persuasive essay', subject: 'ela', grade: '7', language: 'es' };

  it('fills 4 criteria and 4 levels by default, with no class or student data', () => {
    expect(createRubricRequest(input)).toEqual({
      ok: true,
      value: {
        topic: 'Persuasive essay',
        subject: 'ela',
        grade: '7',
        title: null,
        criteriaCount: 4,
        levelCount: 4,
        language: 'es',
        esl: false,
        instructions: null,
      },
    });
  });

  it('needs a topic and counts within the grid limits', () => {
    expect(createRubricRequest({ ...input, topic: '' }).ok).toBe(false);
    expect(createRubricRequest({ ...input, criteriaCount: 11 })).toEqual({
      ok: false,
      error: { field: 'criteriaCount', code: 'out_of_range' },
    });
    expect(createRubricRequest({ ...input, levelCount: 1 })).toEqual({
      ok: false,
      error: { field: 'levelCount', code: 'out_of_range' },
    });
    expect(createRubricRequest({ ...input, esl: true, subject: '' })).toMatchObject({
      ok: true,
      value: { esl: true, subject: null },
    });
  });
});
