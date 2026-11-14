import { approvalActions, type AuditAction, type AuditEvent, type SchoolId } from '@thp/domain';
import type { ApprovalFilter, ApprovalLogReader, AuditLog, RateLimiter } from '@thp/ports';

export class InMemoryRateLimiter implements RateLimiter {
  private readonly counts = new Map<string, number>();

  hit(input: { key: string; limit: number; windowMs: number; at: Date }): Promise<boolean> {
    const window = Math.floor(input.at.getTime() / input.windowMs);
    const slot = `${input.key}@${String(window)}`;
    const count = (this.counts.get(slot) ?? 0) + 1;
    this.counts.set(slot, count);
    return Promise.resolve(count <= input.limit);
  }
}

export class InMemoryAuditLog implements AuditLog, ApprovalLogReader {
  readonly events: AuditEvent[] = [];

  record(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  listForSchool(schoolId: SchoolId, limit: number): Promise<readonly AuditEvent[]> {
    return Promise.resolve(
      this.events
        .filter((event) => event.schoolId === schoolId)
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, limit),
    );
  }

  listApprovals(
    schoolId: SchoolId,
    filter: ApprovalFilter,
    limit: number,
  ): Promise<readonly AuditEvent[]> {
    const actions: readonly AuditAction[] = filter.actions ?? approvalActions;
    return Promise.resolve(
      this.events
        .filter(
          (event) =>
            event.schoolId === schoolId &&
            actions.includes(event.action) &&
            (filter.actorId === undefined || event.actorId === filter.actorId) &&
            (filter.from === undefined || event.at >= filter.from) &&
            (filter.to === undefined || event.at < filter.to),
        )
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, limit),
    );
  }
}
