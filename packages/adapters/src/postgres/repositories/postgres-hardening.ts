import { sql, type Kysely } from 'kysely';
import {
  approvalActions,
  approvalReviews,
  auditActions,
  type ApprovalReview,
  type AuditAction,
  type AuditEvent,
  type AuditEventId,
  type ClassId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { ApprovalFilter, ApprovalLogReader, AuditLog, RateLimiter } from '@thp/ports';
import { oneOf } from '../mappers/columns.ts';
import type { AuditEventsTable, Database } from '../schema.ts';

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

const toEvent = (row: AuditEventsTable): AuditEvent => ({
  id: row.id as AuditEventId,
  schoolId: row.school_id as SchoolId,
  actorId: row.actor_id as UserId,
  action: oneOf<AuditAction>(auditActions, row.action, 'audit_events.action'),
  targetId: row.target_id,
  at: row.at,
  review:
    row.review === null
      ? null
      : oneOf<ApprovalReview>(approvalReviews, row.review, 'audit_events.review'),
  count: row.count,
  classId: row.class_id as ClassId | null,
});

/** The activity log is append-only: it has no way to change or remove a line. */
export class PostgresAuditLog implements AuditLog, ApprovalLogReader {
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
        review: event.review,
        count: event.count,
        class_id: event.classId,
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
    return rows.map(toEvent);
  }

  async listApprovals(
    schoolId: SchoolId,
    filter: ApprovalFilter,
    limit: number,
  ): Promise<readonly AuditEvent[]> {
    const actions = filter.actions ?? approvalActions;
    if (actions.length === 0) return [];
    let query = this.db
      .selectFrom('audit_events')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('action', 'in', actions);
    if (filter.actorId !== undefined) query = query.where('actor_id', '=', filter.actorId);
    if (filter.from !== undefined) query = query.where('at', '>=', filter.from);
    if (filter.to !== undefined) query = query.where('at', '<', filter.to);
    const rows = await query.orderBy('at', 'desc').limit(limit).execute();
    return rows.map(toEvent);
  }
}
