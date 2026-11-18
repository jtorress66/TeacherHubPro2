import type { Kysely } from 'kysely';
import {
  referralStatuses,
  type Referral,
  type ReferralCode,
  type ReferralId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { ReferralRepository } from '@thp/ports';
import { oneOf } from '../mappers/columns.ts';
import type { Database, ReferralCodesTable, ReferralsTable } from '../schema.ts';

const toCode = (row: ReferralCodesTable): ReferralCode => ({
  code: row.code,
  userId: row.user_id as UserId,
  schoolId: row.school_id as SchoolId,
});

const toReferral = (row: ReferralsTable): Referral => ({
  id: row.id as ReferralId,
  referrerId: row.referrer_id as UserId,
  referrerSchoolId: row.referrer_school_id as SchoolId,
  invitedSchoolId: row.invited_school_id as SchoolId,
  joinedAt: row.joined_at,
  status: oneOf(referralStatuses, row.status, 'referrals.status'),
  decidedAt: row.decided_at,
});

export class PostgresReferralRepository implements ReferralRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findCodeOf(schoolId: SchoolId, userId: UserId): Promise<ReferralCode | null> {
    const row = await this.db
      .selectFrom('referral_codes')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row === undefined ? null : toCode(row);
  }

  async findCode(code: string): Promise<ReferralCode | null> {
    const row = await this.db
      .selectFrom('referral_codes')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirst();
    return row === undefined ? null : toCode(row);
  }

  async addCode(code: ReferralCode): Promise<boolean> {
    const inserted = await this.db
      .insertInto('referral_codes')
      .values({ code: code.code, user_id: code.userId, school_id: code.schoolId })
      .onConflict((conflict) => conflict.doNothing())
      .executeTakeFirst();
    return inserted.numInsertedOrUpdatedRows === 1n;
  }

  async save(referral: Referral): Promise<void> {
    const row = {
      id: referral.id,
      referrer_id: referral.referrerId,
      referrer_school_id: referral.referrerSchoolId,
      invited_school_id: referral.invitedSchoolId,
      joined_at: referral.joinedAt,
      status: referral.status,
      decided_at: referral.decidedAt,
    };
    await this.db
      .insertInto('referrals')
      .values(row)
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({ status: row.status, decided_at: row.decided_at }),
      )
      .execute();
  }

  async findByInvitedSchool(schoolId: SchoolId): Promise<Referral | null> {
    const row = await this.db
      .selectFrom('referrals')
      .selectAll()
      .where('invited_school_id', '=', schoolId)
      .executeTakeFirst();
    return row === undefined ? null : toReferral(row);
  }

  async listForReferrer(schoolId: SchoolId, userId: UserId): Promise<readonly Referral[]> {
    const rows = await this.db
      .selectFrom('referrals')
      .selectAll()
      .where('referrer_school_id', '=', schoolId)
      .where('referrer_id', '=', userId)
      .orderBy('joined_at')
      .orderBy('id')
      .execute();
    return rows.map(toReferral);
  }
}
