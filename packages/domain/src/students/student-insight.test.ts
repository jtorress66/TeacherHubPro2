import { describe, expect, it } from 'vitest';
import type { SchoolId, StudentId, UserId } from '../shared/ids.ts';
import { createStudentInsight } from './student-insight.ts';

const base = {
  schoolId: 's1' as SchoolId,
  studentId: 'st1' as StudentId,
  teacherId: 'u1' as UserId,
  generatedAt: new Date('2026-11-05T12:00:00Z'),
};

describe('createStudentInsight', () => {
  it('keeps three to five trimmed bullets', () => {
    expect(createStudentInsight({ ...base, bullets: [' One ', 'Two', 'Three'] })).toEqual({
      ok: true,
      value: { ...base, bullets: ['One', 'Two', 'Three'] },
    });
  });

  it('refuses too few or too many bullets, a blank one or a long one', () => {
    const refused = (bullets: string[]) => createStudentInsight({ ...base, bullets }).ok;
    expect(refused(['One', 'Two'])).toBe(false);
    expect(refused(['1', '2', '3', '4', '5', '6'])).toBe(false);
    expect(refused(['One', ' ', 'Three'])).toBe(false);
    expect(refused(['One', 'Two', 'x'.repeat(301)])).toBe(false);
  });
});
