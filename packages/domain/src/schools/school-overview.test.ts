import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import { valueOf } from '../test-support.ts';
import { createSchool } from './school.ts';
import {
  canManageSchool,
  setSchoolFeatures,
  summarizeUsage,
  usageSince,
  type TeacherUsage,
} from './school-overview.ts';

const schoolId = 'school-1' as SchoolId;
const person = (id: string, role: 'teacher' | 'school_admin' | 'super_admin') => ({
  id: id as UserId,
  schoolId,
  role,
});

describe('school features', () => {
  it('starts with AI and student flags on', () => {
    expect(valueOf(createSchool({ id: schoolId, name: 'A' })).features).toEqual({
      ai: true,
      studentFlags: true,
    });
  });

  it('can turn either one off, keeping everything else', () => {
    const school = valueOf(createSchool({ id: schoolId, name: 'A', planFormat: 'simple' }));
    const changed = setSchoolFeatures(school, { ai: false, studentFlags: true });
    expect(changed).toEqual({ ...school, features: { ai: false, studentFlags: true } });
  });
});

describe('canManageSchool', () => {
  it("lets the school's admins and the subscription owner manage it", () => {
    expect(canManageSchool(person('a', 'school_admin'), null)).toBe(true);
    expect(canManageSchool(person('t', 'teacher'), { ownerId: 't' as UserId })).toBe(true);
  });

  it('keeps other teachers out', () => {
    expect(canManageSchool(person('t', 'teacher'), { ownerId: 'o' as UserId })).toBe(false);
    expect(canManageSchool(person('t', 'teacher'), null)).toBe(false);
  });
});

describe('usage', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const row = (overrides: Partial<TeacherUsage>): TeacherUsage => ({
    teacherId: 't' as UserId,
    name: 'Ana',
    lastActiveAt: null,
    classes: 0,
    students: 0,
    aiDrafts: 0,
    attendanceDays: 0,
    assignments: 0,
    ...overrides,
  });

  it('looks back 30 days', () => {
    expect(usageSince(now)).toEqual(new Date('2026-10-21T12:00:00Z'));
  });

  it('adds up the school, counting a teacher as active when seen in the last 30 days', () => {
    const totals = summarizeUsage(
      [
        row({ lastActiveAt: new Date('2026-11-19T08:00:00Z'), students: 20, aiDrafts: 4 }),
        row({ lastActiveAt: new Date('2026-09-01T08:00:00Z'), students: 5, attendanceDays: 2 }),
        row({ lastActiveAt: null, students: 3, aiDrafts: 1, attendanceDays: 3 }),
      ],
      now,
    );
    expect(totals).toEqual({
      teachers: 3,
      activeTeachers: 1,
      students: 28,
      aiDrafts: 5,
      attendanceDays: 5,
    });
  });
});
