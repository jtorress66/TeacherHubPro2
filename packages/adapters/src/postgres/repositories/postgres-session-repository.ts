import type { Kysely, Selectable } from 'kysely';
import {
  isBrowserKey,
  isOsKey,
  type DeviceKeys,
  type SchoolId,
  type Session,
  type SessionEndedReason,
  type UserId,
} from '@thp/domain';
import type { SessionRepository } from '@thp/ports';
import type { Database, SessionsTable } from '../schema.ts';

/** Stored keys the app no longer knows read as unknown; no keys at all is no device. */
function deviceOf(row: Selectable<SessionsTable>): DeviceKeys | null {
  if (row.device_browser === null && row.device_os === null) return null;
  return {
    browser: isBrowserKey(row.device_browser) ? row.device_browser : 'unknown',
    os: isOsKey(row.device_os) ? row.device_os : 'unknown',
  };
}

const endedReasonOf = (value: string | null): SessionEndedReason | null =>
  value === 'replaced' ? value : null;

function toSession(row: Selectable<SessionsTable>): Session {
  const endedReason = endedReasonOf(row.ended_reason);
  return {
    tokenHash: row.token_hash,
    userId: row.user_id as UserId,
    schoolId: row.school_id as SchoolId,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    device: deviceOf(row),
    endedAt: endedReason === null ? null : row.ended_at,
    endedReason,
  };
}

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
      last_seen_at: session.lastSeenAt,
      device_browser: session.device?.browser ?? null,
      device_os: session.device?.os ?? null,
      ended_at: session.endedAt,
      ended_reason: session.endedReason,
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
    return row === undefined ? null : toSession(row);
  }

  async listActiveForUser(userId: UserId, now: Date): Promise<readonly Session[]> {
    const rows = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('ended_at', 'is', null)
      .where('expires_at', '>', now)
      .execute();
    return rows.map(toSession);
  }

  async endAllForUserExcept(
    userId: UserId,
    keepTokenHash: string,
    reason: SessionEndedReason,
    at: Date,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('sessions')
        .where('user_id', '=', userId)
        .where('token_hash', '<>', keepTokenHash)
        .where('expires_at', '<=', at)
        .execute();
      await trx
        .updateTable('sessions')
        .set({ ended_at: at, ended_reason: reason })
        .where('user_id', '=', userId)
        .where('token_hash', '<>', keepTokenHash)
        .where('ended_at', 'is', null)
        .execute();
    });
  }

  async touch(tokenHash: string, at: Date): Promise<void> {
    await this.db
      .updateTable('sessions')
      .set({ last_seen_at: at })
      .where('token_hash', '=', tokenHash)
      .where('ended_at', 'is', null)
      .execute();
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.deleteFrom('sessions').where('token_hash', '=', tokenHash).execute();
  }

  async deleteAllForUser(userId: UserId): Promise<void> {
    await this.db.deleteFrom('sessions').where('user_id', '=', userId).execute();
  }
}
