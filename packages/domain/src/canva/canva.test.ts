import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import { canvaTitle, connectCanva } from './canva.ts';

describe('Canva', () => {
  it('keeps one connection per teacher, identified by the teacher', () => {
    const connectedAt = new Date('2026-11-10T12:00:00Z');
    expect(
      connectCanva({
        schoolId: 'school-1' as SchoolId,
        teacherId: 'teacher-1' as UserId,
        encryptedRefreshToken: 'sealed',
        connectedAt,
      }),
    ).toEqual({
      id: 'teacher-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      encryptedRefreshToken: 'sealed',
      connectedAt,
    });
  });

  it('shortens a design title to the 50 characters Canva accepts, without cutting a letter in half', () => {
    expect(canvaTitle('  Fractions week  ')).toBe('Fractions week');
    expect(canvaTitle('a'.repeat(60))).toBe('a'.repeat(50));
    expect(canvaTitle('分数'.repeat(40))).toHaveLength(50);
    expect(canvaTitle('🍎'.repeat(60))).toBe('🍎'.repeat(25));
    expect(canvaTitle(`${'a'.repeat(49)}🍎`)).toBe('a'.repeat(49));
  });

  it('gives an untitled design a name', () => {
    expect(canvaTitle('   ')).toBe('TeacherHubPro');
  });
});
