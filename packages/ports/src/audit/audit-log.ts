import type { AuditEvent, SchoolId } from '@thp/domain';

/** A school's activity log: append-only, read newest first. */
export interface AuditLog {
  record(event: AuditEvent): Promise<void>;
  listForSchool(schoolId: SchoolId, limit: number): Promise<readonly AuditEvent[]>;
}
