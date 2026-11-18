import { describe, expect, it } from 'vitest';
import {
  decideReferral,
  joinReferral,
  type ReferralCode,
  type ReferralId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { ReferralRepository } from '@thp/ports';

/** Uses the shared fixtures: teacher-1 and teacher-2 at school-a, and school-b as the new school. */
const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher1 = 'teacher-1' as UserId;
const teacher2 = 'teacher-2' as UserId;
const now = new Date('2026-11-17T12:00:00Z');

const codeOf = (code: string, userId: UserId = teacher1): ReferralCode => ({
  code,
  userId,
  schoolId: schoolA,
});

export function referralRepositoryContract(name: string, make: () => ReferralRepository): void {
  describe(`${name} (ReferralRepository contract)`, () => {
    it('keeps a teacher’s code and finds it by teacher or by code', async () => {
      const referrals = make();

      expect(await referrals.addCode(codeOf('K7M2QX9P'))).toBe(true);

      expect(await referrals.findCodeOf(schoolA, teacher1)).toEqual(codeOf('K7M2QX9P'));
      expect(await referrals.findCode('K7M2QX9P')).toEqual(codeOf('K7M2QX9P'));
      expect(await referrals.findCode('ZZZZZZZZ')).toBeNull();
      expect(await referrals.findCodeOf(schoolB, teacher1)).toBeNull();
    });

    it('refuses a taken code and a second code for the same teacher', async () => {
      const referrals = make();
      await referrals.addCode(codeOf('K7M2QX9P'));

      expect(await referrals.addCode(codeOf('K7M2QX9P', teacher2))).toBe(false);
      expect(await referrals.addCode(codeOf('AAAABBBB'))).toBe(false);
      expect(await referrals.findCodeOf(schoolA, teacher2)).toBeNull();
    });

    it('keeps referrals, finds one by the new school and lists them for the inviter', async () => {
      const referrals = make();
      const joined = joinReferral({
        id: 'referral-1' as ReferralId,
        code: codeOf('K7M2QX9P'),
        invitedSchoolId: schoolB,
        now,
      });
      await referrals.save(joined);
      const rewarded = decideReferral(joined, true, new Date('2026-12-01T12:00:00Z'));
      await referrals.save(rewarded);

      expect(await referrals.findByInvitedSchool(schoolB)).toEqual(rewarded);
      expect(await referrals.findByInvitedSchool(schoolA)).toBeNull();
      expect(await referrals.listForReferrer(schoolA, teacher1)).toEqual([rewarded]);
      expect(await referrals.listForReferrer(schoolA, teacher2)).toEqual([]);
      expect(await referrals.listForReferrer(schoolB, teacher1)).toEqual([]);
    });
  });
}
