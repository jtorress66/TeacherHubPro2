import type { AuditEvent, SchoolId } from '@thp/domain';
import type { AuditLog, RateLimiter } from '@thp/ports';

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

export class InMemoryAuditLog implements AuditLog {
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
}
