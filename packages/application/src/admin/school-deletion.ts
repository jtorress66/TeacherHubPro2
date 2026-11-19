import {
  canDeleteSchoolData,
  matchesSchoolName,
  ok,
  requestSchoolDeletion,
  type AuditAction,
  type AuditEventId,
  type Result,
  type SchoolDeletionRequest,
  type Subscription,
  type User,
} from '@thp/domain';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  Mailer,
  MailTemplates,
  SchoolDeletionRepository,
  SchoolEraser,
  SchoolRepository,
  SubscriptionRenewal,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';

interface AccessDeps {
  readonly users: UserRepository;
  readonly subscriptions: SubscriptionRepository;
}

interface ChangeDeps extends AccessDeps {
  readonly schoolDeletions: SchoolDeletionRepository;
  readonly subscriptionRenewal: SubscriptionRenewal;
  readonly auditLog: AuditLog;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

async function isOpenTo(deps: AccessDeps, actor: User): Promise<boolean> {
  const subscription = await findSchoolSubscription(deps.subscriptions, actor.schoolId);
  const members = await deps.users.listBySchool(actor.schoolId);
  return canDeleteSchoolData(actor, subscription, members);
}

/** A paid plan that would still charge again; an ended plan has nothing to stop or resume. */
const renewing = (subscription: Subscription | null): string | null =>
  subscription !== null && subscription.status !== 'canceled' && subscription.status !== 'expired'
    ? subscription.externalId
    : null;

async function record(deps: ChangeDeps, actor: User, action: AuditAction): Promise<void> {
  await deps.auditLog.record({
    id: deps.ids.next() as AuditEventId,
    schoolId: actor.schoolId,
    actorId: actor.id,
    action,
    targetId: null,
    at: deps.clock.now(),
    review: null,
    count: null,
    classId: null,
  });
}

/**
 * The owner or an admin asks to delete all of the school's data, typing its name to confirm. The
 * data goes after a 30-day hold; a paid plan stops renewing now, so nothing more is charged.
 */
export class RequestSchoolDeletion {
  constructor(
    private readonly deps: ChangeDeps & {
      readonly schools: SchoolRepository;
      readonly mailer: Mailer;
      readonly mailTemplates: MailTemplates;
      readonly appUrl: string;
    },
  ) {}

  isOpenTo(actor: User): Promise<boolean> {
    return isOpenTo(this.deps, actor);
  }

  async execute(input: {
    readonly actor: User;
    readonly typedName: string;
  }): Promise<Result<SchoolDeletionRequest, UseCaseError>> {
    const { actor } = input;
    if (!(await this.isOpenTo(actor))) return fail('forbidden');
    const school = await this.deps.schools.findById(actor.schoolId);
    if (school === null) return fail('not_found');
    if (!matchesSchoolName(input.typedName, school.name)) return fail('name_mismatch');
    const pending = await this.deps.schoolDeletions.findBySchool(actor.schoolId);
    if (pending !== null) return ok(pending);

    const externalId = renewing(
      await findSchoolSubscription(this.deps.subscriptions, actor.schoolId),
    );
    if (externalId !== null) {
      const stopped = await this.deps.subscriptionRenewal.stopRenewal(externalId);
      if (!stopped.ok) return fail('renewal_failed');
    }
    const request = requestSchoolDeletion({
      schoolId: actor.schoolId,
      requestedBy: actor.id,
      now: this.deps.clock.now(),
    });
    await this.deps.schoolDeletions.save(request);
    await record(this.deps, actor, 'school_deletion_requested');
    // The email is a safeguard, not a step: the request stands if it cannot be sent.
    await this.deps.mailer.send({
      to: actor.email,
      ...this.deps.mailTemplates.schoolDeletionRequested({
        language: actor.language,
        name: actor.name,
        schoolName: school.name,
        deleteAfter: request.deleteAfter,
        settingsUrl: `${this.deps.appUrl}/${actor.language}/app/settings`,
      }),
    });
    return ok(request);
  }
}

/** Keeps the school: drops the request and lets a paid plan renew again. */
export class CancelSchoolDeletion {
  constructor(private readonly deps: ChangeDeps) {}

  async execute(input: { readonly actor: User }): Promise<Result<true, UseCaseError>> {
    const { actor } = input;
    if (!(await isOpenTo(this.deps, actor))) return fail('forbidden');
    if ((await this.deps.schoolDeletions.findBySchool(actor.schoolId)) === null) {
      return fail('not_found');
    }
    const externalId = renewing(
      await findSchoolSubscription(this.deps.subscriptions, actor.schoolId),
    );
    if (externalId !== null) {
      const resumed = await this.deps.subscriptionRenewal.resumeRenewal(externalId);
      if (!resumed.ok) return fail('renewal_failed');
    }
    await this.deps.schoolDeletions.remove(actor.schoolId);
    await record(this.deps, actor, 'school_deletion_canceled');
    return ok(true);
  }
}

/** The pending request of the person's school, which everyone in it is shown. */
export class GetSchoolDeletion {
  constructor(private readonly deps: { readonly schoolDeletions: SchoolDeletionRepository }) {}

  execute(input: { readonly actor: User }): Promise<SchoolDeletionRequest | null> {
    return this.deps.schoolDeletions.findBySchool(input.actor.schoolId);
  }
}

/** Run by the worker: deletes every school whose hold is over. Returns how many it deleted. */
export class DeleteDueSchools {
  constructor(
    private readonly deps: {
      readonly schoolDeletions: SchoolDeletionRepository;
      readonly schoolEraser: SchoolEraser;
      readonly clock: Clock;
    },
  ) {}

  async execute(): Promise<number> {
    const now = this.deps.clock.now();
    const due = await this.deps.schoolDeletions.listDue(now);
    for (const request of due) await this.deps.schoolEraser.erase(request, now);
    return due.length;
  }
}
