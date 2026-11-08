import {
  isAdminOf,
  ok,
  rateRules,
  type AuditAction,
  type AuditEvent,
  type AuditEventId,
  type RateRuleName,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type { AuditLog, Clock, IdGenerator, RateLimiter, TokenHasher } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

/** Counts a try at a limited action; refuses with `rate_limited` once its rule is used up. */
export class Throttle {
  constructor(
    private readonly deps: {
      readonly rateLimiter: RateLimiter;
      readonly tokenHasher: TokenHasher;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    rule: RateRuleName;
    /** Who is trying: an email, an address or a link token. Only its hash is stored. */
    subject: string;
  }): Promise<Result<void, UseCaseError>> {
    const key = await this.deps.tokenHasher.hash(`${input.rule}:${input.subject.toLowerCase()}`);
    const allowed = await this.deps.rateLimiter.hit({
      key,
      ...rateRules[input.rule],
      at: this.deps.clock.now(),
    });
    return allowed ? ok(undefined) : fail('rate_limited');
  }
}

/** Adds one line to the actor's school activity log. */
export class RecordActivity {
  constructor(
    private readonly deps: {
      readonly auditLog: AuditLog;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    actor: User;
    action: AuditAction;
    targetId?: string;
    /** The school acted on, when a super admin works on another school; else the actor's. */
    schoolId?: SchoolId;
  }): Promise<void> {
    await this.deps.auditLog.record({
      id: this.deps.ids.next() as AuditEventId,
      schoolId: input.schoolId ?? input.actor.schoolId,
      actorId: input.actor.id,
      action: input.action,
      targetId: input.targetId ?? null,
      at: this.deps.clock.now(),
    });
  }
}

export const maxListedActivity = 200;

/** A school's latest activity, for its admins and super admins only. */
export class ListActivity {
  constructor(private readonly deps: { readonly auditLog: AuditLog }) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
  }): Promise<Result<readonly AuditEvent[], UseCaseError>> {
    if (!isAdminOf(input.actor, input.schoolId)) return fail('forbidden');
    return ok(await this.deps.auditLog.listForSchool(input.schoolId, maxListedActivity));
  }
}
