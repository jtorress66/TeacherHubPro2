import type { Referral, ReferralCode, SchoolId, UserId } from '@thp/domain';

/** Invite codes and the colleagues who joined through them. */
export interface ReferralRepository {
  findCodeOf(schoolId: SchoolId, userId: UserId): Promise<ReferralCode | null>;
  /** Unscoped on purpose: a sign-up link names only the code. */
  findCode(code: string): Promise<ReferralCode | null>;
  /** Keeps a new code; false when the code is taken or the teacher already has one. */
  addCode(code: ReferralCode): Promise<boolean>;
  save(referral: Referral): Promise<void>;
  /** Unscoped on purpose: a payment names the colleague's school, not the inviter's. */
  findByInvitedSchool(schoolId: SchoolId): Promise<Referral | null>;
  listForReferrer(schoolId: SchoolId, userId: UserId): Promise<readonly Referral[]>;
}
