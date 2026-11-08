import { sql, type Kysely } from 'kysely';
import {
  auditActions,
  type AuditAction,
  type AuditEvent,
  type AuditEventId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { AuditLog, RateLimiter } from '@thp/ports';
import { oneOf } from '../mappers/columns.ts';
import type { Database } from '../schema.ts';

export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly db: Kysely<Database>) {}

  async hit(input: { key: string; limit: number; windowMs: number; at: Date }): Promise<boolean> {
    const start = new Date(Math.floor(input.at.getTime() / input.windowMs) * input.windowMs);
    // This key's finished windows are never read again.
    await this.db
      .deleteFrom('rate_limits')
      .where('key', '=', input.key)
      .where('window_start', '<', start)
      .execute();
    const row = await this.db
      .insertInto('rate_limits')
      .values({ key: input.key, window_start: start, count: 1 })
      .onConflict((c) =>
        c.columns(['key', 'window_start']).doUpdateSet({ count: sql`rate_limits.count + 1` }),
      )
      .returning('count')
      .executeTakeFirstOrThrow();
    return row.count <= input.limit;
  }
}

export class PostgresAuditLog implements AuditLog {
  constructor(private readonly db: Kysely<Database>) {}

  async record(event: AuditEvent): Promise<void> {
    await this.db
      .insertInto('audit_events')
      .values({
        id: event.id,
        school_id: event.schoolId,
        actor_id: event.actorId,
        action: event.action,
        target_id: event.targetId,
        at: event.at,
      })
      .execute();
  }

  async listForSchool(schoolId: SchoolId, limit: number): Promise<readonly AuditEvent[]> {
    const rows = await this.db
      .selectFrom('audit_events')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('at', 'desc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      id: row.id as AuditEventId,
      schoolId: row.school_id as SchoolId,
      actorId: row.actor_id as UserId,
      action: oneOf<AuditAction>(auditActions, row.action, 'audit_events.action'),
      targetId: row.target_id,
      at: row.at,
    }));
  }
}
