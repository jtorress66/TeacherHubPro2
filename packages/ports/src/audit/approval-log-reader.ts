import type { ApprovalAction, AuditEvent, SchoolId, UserId } from '@thp/domain';

export interface ApprovalFilter {
  /** Only this person's approvals. */
  readonly actorId?: UserId;
  /** Only these kinds; every approval kind when left out. */
  readonly actions?: readonly ApprovalAction[];
  /** From this moment on (inclusive). */
  readonly from?: Date;
  /** Before this moment (exclusive). */
  readonly to?: Date;
}

/** Reads a school's approvals from its activity log, newest first. The log is never changed. */
export interface ApprovalLogReader {
  listApprovals(
    schoolId: SchoolId,
    filter: ApprovalFilter,
    limit: number,
  ): Promise<readonly AuditEvent[]>;
}
