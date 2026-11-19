import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import {
  canDeleteSchoolData,
  deletionHoldDays,
  isDueForDeletion,
  matchesSchoolName,
  requestSchoolDeletion,
} from './school-deletion.ts';

const schoolId = 'school-1' as SchoolId;
const owner = { id: 'u-owner' as UserId, schoolId, role: 'teacher' as const };
const admin = { id: 'u-admin' as UserId, schoolId, role: 'school_admin' as const };
const colleague = { id: 'u-colleague' as UserId, schoolId, role: 'teacher' as const };
const superAdmin = { id: 'u-super' as UserId, schoolId, role: 'super_admin' as const };
const subscription = { ownerId: owner.id };

describe('requestSchoolDeletion', () => {
  it('holds the request for 30 days before the data is deleted', () => {
    const now = new Date('2026-11-19T15:30:00Z');
    const request = requestSchoolDeletion({ schoolId, requestedBy: owner.id, now });

    expect(deletionHoldDays).toBe(30);
    expect(request).toEqual({
      schoolId,
      requestedBy: owner.id,
      requestedAt: now,
      deleteAfter: new Date('2026-12-19T15:30:00Z'),
    });
  });
});

describe('isDueForDeletion', () => {
  const request = requestSchoolDeletion({
    schoolId,
    requestedBy: owner.id,
    now: new Date('2026-11-19T15:30:00Z'),
  });

  it('is not due during the hold', () => {
    expect(isDueForDeletion(request, new Date('2026-12-19T15:29:59Z'))).toBe(false);
  });

  it('is due once the hold is over', () => {
    expect(isDueForDeletion(request, new Date('2026-12-19T15:30:00Z'))).toBe(true);
    expect(isDueForDeletion(request, new Date('2027-01-05T00:00:00Z'))).toBe(true);
  });
});

describe('matchesSchoolName', () => {
  it('accepts the exact name', () => {
    expect(matchesSchoolName('Colegio Luna', 'Colegio Luna')).toBe(true);
  });

  it('ignores upper and lower case and extra spaces', () => {
    expect(matchesSchoolName('  colegio   LUNA ', 'Colegio Luna')).toBe(true);
  });

  it('treats the same accented letter typed two ways as the same', () => {
    expect(matchesSchoolName('Concepción', 'Concepción')).toBe(true);
  });

  it('refuses a different or empty name', () => {
    expect(matchesSchoolName('Colegio Sol', 'Colegio Luna')).toBe(false);
    expect(matchesSchoolName('Colegio', 'Colegio Luna')).toBe(false);
    expect(matchesSchoolName('   ', 'Colegio Luna')).toBe(false);
  });
});

describe('canDeleteSchoolData', () => {
  it('lets the account owner and the school admins ask', () => {
    expect(canDeleteSchoolData(owner, subscription, [owner, admin, colleague])).toBe(true);
    expect(canDeleteSchoolData(admin, subscription, [owner, admin, colleague])).toBe(true);
  });

  it('refuses other teachers', () => {
    expect(canDeleteSchoolData(colleague, subscription, [owner, admin, colleague])).toBe(false);
  });

  it('refuses a school that has a super admin, so the platform owner is never deleted', () => {
    expect(canDeleteSchoolData(admin, subscription, [owner, admin, superAdmin])).toBe(false);
    expect(canDeleteSchoolData(superAdmin, subscription, [superAdmin])).toBe(false);
  });
});
