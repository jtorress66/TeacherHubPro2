import {
  err,
  grantTrialDays,
  ok,
  type AuditEventId,
  type Result,
  type SchoolId,
  type Subscription,
  type User,
} from '@thp/domain';
import type { AuditLog, Clock, IdGenerator, SubscriptionRepository } from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { requireSuperAdmin } from './admin-access.ts';

export type SchoolTrial = Pick<Subscription, 'status' | 'trialEndsAt'>;

const trialOf = (subscription: Subscription): SchoolTrial => ({
  status: subscription.status,
  trialEndsAt: subscription.trialEndsAt,
});

/** A school's subscription status and trial end, for a super admin; null when it has none. */
export class GetSchoolTrial {
  constructor(private readonly deps: { readonly subscriptions: SubscriptionRepository }) {}

  async execute(input: {
    readonly actor: User;
    readonly schoolId: SchoolId;
  }): Promise<Result<SchoolTrial | null, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const subscription = await findSchoolSubscription(this.deps.subscriptions, input.schoolId);
    return ok(subscription === null ? null : trialOf(subscription));
  }
}

/**
 * A super admin gives a school more trial days, for example an app reviewer or a pilot school.
 * It is written in the school's activity log; a paying school is left alone.
 */
export class ExtendSchoolTrial {
  constructor(
    private readonly deps: {
      readonly subscriptions: SubscriptionRepository;
      readonly auditLog: AuditLog;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly schoolId: SchoolId;
    readonly days: number;
  }): Promise<Result<SchoolTrial, UseCaseError>> {
    const { actor, schoolId, days } = input;
    const allowed = requireSuperAdmin(actor);
    if (!allowed.ok) return allowed;
    const subscription = await findSchoolSubscription(this.deps.subscriptions, schoolId);
    if (subscription === null) return fail('not_found');
    const now = this.deps.clock.now();
    const extended = grantTrialDays(subscription, days, now);
    if (!extended.ok) {
      const { error } = extended;
      return 'field' in error ? err(error) : fail('school_is_paying');
    }
    await this.deps.subscriptions.save(extended.value);
    await this.deps.auditLog.record({
      id: this.deps.ids.next() as AuditEventId,
      schoolId,
      actorId: actor.id,
      action: 'school_trial_extended',
      targetId: null,
      at: now,
      review: null,
      count: days,
      classId: null,
    });
    return ok(trialOf(extended.value));
  }
}
