import {
  approvalActions,
  isAdminOf,
  ok,
  type ApprovalAction,
  type ApprovalReview,
  type AuditEvent,
  type AuditEventId,
  type ClassId,
  type Result,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import type {
  ApprovalFilter,
  ApprovalLogReader,
  AuditLog,
  ClassRepository,
  Clock,
  IdGenerator,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { approvalItems, type ApprovalItem, type ApprovalItemDeps } from './approval-items.ts';

/** What a use case needs to log an approval. */
export interface ApprovalLogDeps {
  readonly auditLog: AuditLog;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface Approval {
  readonly actor: User;
  readonly action: ApprovalAction;
  /** The school the approved item belongs to. */
  readonly schoolId: SchoolId;
  /** The approved item: a submission, game, prep batch or learning path. */
  readonly targetId: string;
  readonly classId: ClassId | null;
  readonly review?: ApprovalReview;
  readonly count?: number;
}

/**
 * Adds an approval to the school's activity log. Called by the approving use case after the
 * save, so no screen or job can skip it. Only IDs and counts are stored, never content.
 */
export async function recordApproval(deps: ApprovalLogDeps, approval: Approval): Promise<void> {
  await deps.auditLog.record({
    id: deps.ids.next() as AuditEventId,
    schoolId: approval.schoolId,
    actorId: approval.actor.id,
    action: approval.action,
    targetId: approval.targetId,
    at: deps.clock.now(),
    review: approval.review ?? null,
    count: approval.count ?? null,
    classId: approval.classId,
  });
}

export const maxListedApprovals = 500;

export interface ApprovalsQuery {
  /** Admins only: one teacher's approvals. Ignored for teachers, who always see their own. */
  readonly teacherId?: UserId;
  readonly action?: ApprovalAction;
  readonly from?: Date;
  readonly to?: Date;
}

/** One approval with the names a reader needs; never a student's. */
export interface ApprovalRow {
  readonly event: AuditEvent;
  /** Null when the person has left the school. */
  readonly teacherName: string | null;
  /** Null when no class was recorded or it was deleted. */
  readonly className: string | null;
  /** What was approved, looked up now, so renamed or deleted items show as they are. */
  readonly item: ApprovalItem;
}

export interface ApprovalList {
  readonly rows: readonly ApprovalRow[];
  /** Admins only: the school's people, to filter by; empty for a teacher. */
  readonly teachers: readonly { readonly id: UserId; readonly name: string }[];
  /** The list reached its limit, so older approvals may be left out. */
  readonly limited: boolean;
}

/**
 * A school's approvals, newest first. Its admins (and super admins) see everyone's; a teacher
 * sees only their own; anyone from another school is refused.
 */
export class ListApprovals {
  constructor(
    private readonly deps: ApprovalItemDeps & {
      readonly auditLog: ApprovalLogReader;
      readonly users: UserRepository;
      readonly classes: ClassRepository;
    },
  ) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    filter: ApprovalsQuery;
  }): Promise<Result<ApprovalList, UseCaseError>> {
    const { actor, schoolId, filter } = input;
    const admin = isAdminOf(actor, schoolId);
    if (!admin && actor.schoolId !== schoolId) return fail('forbidden');
    const actorId = admin ? filter.teacherId : actor.id;
    const query: ApprovalFilter = {
      ...(actorId === undefined ? {} : { actorId }),
      actions: filter.action === undefined ? approvalActions : [filter.action],
      ...(filter.from === undefined ? {} : { from: filter.from }),
      ...(filter.to === undefined ? {} : { to: filter.to }),
    };
    const [events, users, classes] = await Promise.all([
      this.deps.auditLog.listApprovals(schoolId, query, maxListedApprovals),
      this.deps.users.listBySchool(schoolId),
      this.deps.classes.listBySchool(schoolId, { includeArchived: true }),
    ]);
    const itemOf = await approvalItems(this.deps, schoolId, events);
    const names = new Map<string, string>(users.map((user) => [user.id, user.name]));
    const classNames = new Map<string, string>(classes.map((cls) => [cls.id, cls.name]));
    return ok({
      rows: events.map((event) => ({
        event,
        teacherName: names.get(event.actorId) ?? null,
        className: event.classId === null ? null : (classNames.get(event.classId) ?? null),
        item: itemOf(event),
      })),
      teachers: admin
        ? users
            .map((user) => ({ id: user.id, name: user.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
      limited: events.length >= maxListedApprovals,
    });
  }
}
