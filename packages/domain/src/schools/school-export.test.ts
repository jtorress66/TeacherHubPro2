import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import type { Role } from '../users/roles.ts';
import { canExportSchoolData } from './school-export.ts';

const school = 'school-1' as SchoolId;
const person = (role: Role, id = 'user-1', schoolId = school) => ({
  id: id as UserId,
  schoolId,
  role,
});
const ownedBy = (id: string) => ({ ownerId: id as UserId });

describe('who may download all of a school’s data', () => {
  it('is the school’s admins', () => {
    expect(canExportSchoolData(person('school_admin'), null)).toBe(true);
    expect(canExportSchoolData(person('school_admin'), ownedBy('someone-else'))).toBe(true);
  });

  it('is whoever owns the school’s subscription, such as a teacher with their own account', () => {
    expect(canExportSchoolData(person('teacher'), ownedBy('user-1'))).toBe(true);
  });

  it('is not another teacher of the school', () => {
    expect(canExportSchoolData(person('teacher'), ownedBy('user-2'))).toBe(false);
    expect(canExportSchoolData(person('teacher'), null)).toBe(false);
  });
});
