import type { Kysely } from 'kysely';
import type { SchoolId, Session, UserId } from '@thp/domain';
import type { SessionRepository } from '@thp/ports';
import type { Database } from '../schema.ts';

/** Sessions by token hash. The raw token is never seen here. */
export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(session: Session): Promise<void> {
    const row = {
      token_hash: session.tokenHash,
      user_id: session.userId,
      school_id: session.schoolId,
      created_at: session.createdAt,
      expires_at: session.expiresAt,
    };
    await this.db
      .insertInto('sessions')
      .values(row)
      .onConflict((conflict) => conflict.column('token_hash').doUpdateSet(row))
      .execute();
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row === undefined
      ? null
      : {
          tokenHash: row.token_hash,
          userId: row.user_id as UserId,
          schoolId: row.school_id as SchoolId,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        };
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.deleteFrom('sessions').where('token_hash', '=', tokenHash).execute();
  }

  async deleteAllForUser(userId: UserId): Promise<void> {
    await this.db.deleteFrom('sessions').where('user_id', '=', userId).execute();
  }
}
