import type { Kysely } from 'kysely';
import type { EmailConfirmation, SchoolId, UserId } from '@thp/domain';
import type {
  AiUsage,
  AiUsageStats,
  BlockedDomain,
  BlockedDomainRepository,
  EmailConfirmationRepository,
  FoundEmailConfirmation,
} from '@thp/ports';
import type { Database } from '../schema.ts';

export class PostgresEmailConfirmationRepository implements EmailConfirmationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(confirmation: EmailConfirmation): Promise<void> {
    const row = {
      token_hash: confirmation.tokenHash,
      user_id: confirmation.userId,
      expires_at: confirmation.expiresAt,
      used_at: confirmation.usedAt,
      created_at: confirmation.createdAt,
    };
    await this.db
      .insertInto('email_confirmations')
      .values(row)
      .onConflict((conflict) => conflict.column('token_hash').doUpdateSet(row))
      .execute();
  }

  /** With the school the account belongs to now, so the user can be read in its school. */
  async findByHash(tokenHash: string): Promise<FoundEmailConfirmation | null> {
    const row = await this.db
      .selectFrom('email_confirmations as c')
      .innerJoin('users as u', 'u.id', 'c.user_id')
      .select([
        'c.token_hash',
        'c.user_id',
        'c.expires_at',
        'c.used_at',
        'c.created_at',
        'u.school_id',
      ])
      .where('c.token_hash', '=', tokenHash)
      .executeTakeFirst();
    if (row === undefined) return null;
    return {
      confirmation: {
        tokenHash: row.token_hash,
        userId: row.user_id as UserId,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
      },
      schoolId: row.school_id as SchoolId,
    };
  }

  async revokeFor(userId: UserId, now: Date): Promise<void> {
    await this.db
      .updateTable('email_confirmations')
      .set({ used_at: now })
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .execute();
  }
}

export class PostgresBlockedDomainRepository implements BlockedDomainRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async list(): Promise<readonly BlockedDomain[]> {
    const rows = await this.db
      .selectFrom('blocked_domains')
      .selectAll()
      .orderBy('domain')
      .execute();
    return rows.map((row) => ({
      domain: row.domain,
      createdAt: row.created_at,
      createdBy: row.created_by as UserId | null,
    }));
  }

  async save(blocked: BlockedDomain): Promise<void> {
    await this.db
      .insertInto('blocked_domains')
      .values({
        domain: blocked.domain,
        created_at: blocked.createdAt,
        created_by: blocked.createdBy,
      })
      .onConflict((conflict) => conflict.column('domain').doNothing())
      .execute();
  }

  async remove(domain: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('blocked_domains')
      .where('domain', '=', domain)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}

/** Every background job is AI work (drafts, grading, imports, speech), so jobs are counted. */
export class PostgresAiUsageStats implements AiUsageStats {
  constructor(private readonly db: Kysely<Database>) {}

  async draftsSince(since: Date): Promise<readonly AiUsage[]> {
    const rows = await this.db
      .selectFrom('jobs')
      .select(['owner_id', (eb) => eb.fn.countAll<string>().as('count')])
      .where('created_at', '>=', since)
      .groupBy('owner_id')
      .execute();
    return rows.map((row) => ({ userId: row.owner_id as UserId, drafts: Number(row.count) }));
  }
}
