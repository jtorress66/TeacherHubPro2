import {
  createDraftRequest,
  draftedPlan,
  err,
  ok,
  type DraftRequestInput,
  type DraftedPlan,
  type Job,
  type JobFailure,
  type JobId,
  type LocalDate,
  type LessonPlanDraft,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  JobQueue,
  LessonPlanDrafter,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { checkClass } from './plan-access.ts';

export const draftJobKind = 'lesson_plan.draft';

/** What a draft job stores: the request it answered and the AI's draft. */
interface DraftJobResult {
  readonly start: string;
  readonly draft: LessonPlanDraft;
}

/**
 * Queues an AI draft of a lesson plan. Needs an active subscription or trial; the job holds only
 * what the plan needs, never student data.
 */
export class RequestLessonPlanDraft {
  constructor(
    private readonly deps: {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly classes: ClassRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { actor: User } & DraftRequestInput): Promise<Result<Job, UseCaseError>> {
    const { actor, ...details } = input;
    const access = await checkAiAccess(this.deps, actor.schoolId);
    if (!access.ok) return access;
    const request = createDraftRequest(details);
    if (!request.ok) return request;
    const cls = await checkClass(this.deps.classes, actor, request.value.classId);
    if (!cls.ok) return cls;
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: actor.schoolId,
        ownerId: actor.id,
        kind: draftJobKind,
        payload: request.value,
      }),
    );
  }
}

/** Runs a draft job through the lesson planner agent. */
export class LessonPlanDraftHandler implements JobHandler {
  readonly kind = draftJobKind;

  constructor(private readonly drafter: LessonPlanDrafter) {}

  async handle(job: Job): Promise<Result<DraftJobResult, { readonly code: JobFailure }>> {
    const request = createDraftRequest(job.payload as DraftRequestInput);
    if (!request.ok) return err({ code: 'failed' });
    const draft = await this.drafter.draft(request.value);
    if (!draft.ok) return draft;
    return ok({ start: request.value.start, draft: draft.value });
  }
}

/**
 * The content of a new plan from the actor's finished draft job, for the editor to show. The
 * teacher decides: nothing is saved until they save the plan.
 */
export class GetDraftedPlan {
  constructor(private readonly deps: { readonly jobs: JobQueue }) {}

  async execute(input: { actor: User; jobId: JobId }): Promise<Result<DraftedPlan, UseCaseError>> {
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job?.kind !== draftJobKind || job.status !== 'completed') return fail('not_found');
    const { start, draft } = job.result as DraftJobResult;
    return ok(draftedPlan(draft, start as LocalDate));
  }
}
