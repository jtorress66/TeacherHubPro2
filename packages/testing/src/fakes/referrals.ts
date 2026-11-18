import type { Referral, ReferralCode, SchoolId, UserId } from '@thp/domain';
import type { ReferralRepository } from '@thp/ports';

export class InMemoryReferralRepository implements ReferralRepository {
  private readonly codes: ReferralCode[] = [];
  private readonly referrals = new Map<string, Referral>();

  findCodeOf(schoolId: SchoolId, userId: UserId): Promise<ReferralCode | null> {
    return Promise.resolve(
      this.codes.find((c) => c.schoolId === schoolId && c.userId === userId) ?? null,
    );
  }

  findCode(code: string): Promise<ReferralCode | null> {
    return Promise.resolve(this.codes.find((c) => c.code === code) ?? null);
  }

  addCode(code: ReferralCode): Promise<boolean> {
    if (this.codes.some((c) => c.code === code.code || c.userId === code.userId)) {
      return Promise.resolve(false);
    }
    this.codes.push(code);
    return Promise.resolve(true);
  }

  save(referral: Referral): Promise<void> {
    this.referrals.set(referral.id, referral);
    return Promise.resolve();
  }

  findByInvitedSchool(schoolId: SchoolId): Promise<Referral | null> {
    return Promise.resolve(
      [...this.referrals.values()].find((r) => r.invitedSchoolId === schoolId) ?? null,
    );
  }

  listForReferrer(schoolId: SchoolId, userId: UserId): Promise<readonly Referral[]> {
    return Promise.resolve(
      [...this.referrals.values()].filter(
        (r) => r.referrerSchoolId === schoolId && r.referrerId === userId,
      ),
    );
  }
}
