import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import type { Role } from './roles.ts';
import {
  assignableRoles,
  canDeleteSchool,
  checkMove,
  checkRemoval,
  checkRoleChange,
} from './admin-rules.ts';

const person = (id: string, role: Role, school = 's1') => ({
  id: id as UserId,
  schoolId: school as SchoolId,
  role,
});

const schoolAdmin = person('a1', 'school_admin');
const superAdmin = person('sa', 'super_admin', 's9');
const teacher = person('t1', 'teacher');

describe('assignableRoles', () => {
  it('lets a school admin give teacher or school admin, and a super admin any role', () => {
    expect(assignableRoles(schoolAdmin)).toEqual(['teacher', 'school_admin']);
    expect(assignableRoles(superAdmin)).toEqual(['teacher', 'school_admin', 'super_admin']);
    expect(assignableRoles(teacher)).toEqual([]);
  });
});

describe('checkRoleChange', () => {
  it("lets an admin change a user's role in their school", () => {
    expect(checkRoleChange(schoolAdmin, teacher, 'school_admin')).toEqual({
      ok: true,
      value: true,
    });
    expect(checkRoleChange(superAdmin, teacher, 'super_admin')).toEqual({ ok: true, value: true });
  });

  it('refuses your own role, a role you may not give, a super admin and another school', () => {
    const refused = { ok: false, error: { code: 'forbidden' } };
    expect(checkRoleChange(schoolAdmin, schoolAdmin, 'teacher')).toEqual({
      ok: false,
      error: { code: 'own_account' },
    });
    expect(checkRoleChange(schoolAdmin, teacher, 'super_admin')).toEqual(refused);
    expect(checkRoleChange(schoolAdmin, person('x', 'super_admin'), 'teacher')).toEqual(refused);
    expect(checkRoleChange(schoolAdmin, person('y', 'teacher', 's2'), 'school_admin')).toEqual(
      refused,
    );
    expect(checkRoleChange(teacher, person('z', 'teacher'), 'school_admin')).toEqual(refused);
  });
});

describe('checkRemoval and checkMove', () => {
  it('refuses removing yourself, or anyone who still owns classes', () => {
    expect(checkRemoval(superAdmin, teacher, 0)).toEqual({ ok: true, value: true });
    expect(checkRemoval(superAdmin, superAdmin, 0)).toEqual({
      ok: false,
      error: { code: 'own_account' },
    });
    expect(checkRemoval(superAdmin, teacher, 2)).toEqual({
      ok: false,
      error: { code: 'has_classes' },
    });
  });

  it('moves a user to another school only when they own no classes', () => {
    expect(checkMove(0)).toEqual({ ok: true, value: true });
    expect(checkMove(1)).toEqual({ ok: false, error: { code: 'has_classes' } });
  });
});

describe('canDeleteSchool', () => {
  it('deletes only a school without users', () => {
    expect(canDeleteSchool(0)).toBe(true);
    expect(canDeleteSchool(1)).toBe(false);
  });
});
