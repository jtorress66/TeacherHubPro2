import {
  createRubric,
  createRubricRequest,
  err,
  ok,
  updateRubric,
  type Job,
  type JobFailure,
  type JobId,
  type Result,
  type Rubric,
  type RubricDetails,
  type RubricDraft,
  type RubricId,
  type RubricRequest,
  type RubricRequestInput,
  type User,
} from '@thp/domain';
import type {
  Clock,
  IdGenerator,
  JobQueue,
  RubricDrafter,
  RubricRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { findOwned } from '../assistant/owned.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';

export const rubricDraftJobKind = 'rubric.draft';

/** What a rubric draft job stores: the request it answered and the AI's grid. */
interface DraftJobResult {
  readonly request: RubricRequest;
  readonly draft: RubricDraft;
}

/** Queues an AI draft of a rubric. Needs an active subscription or trial; no student data. */
export class RequestRubricDraft {
  constructor(
    private readonly deps: {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { actor: User } & RubricRequestInput): Promise<Result<Job, UseCaseError>> {
    const { actor, ...details } = input;
    const access = await checkAiAccess(this.deps, actor);
    if (!access.ok) return access;
    const request = createRubricRequest(details);
    if (!request.ok) return request;
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: actor.schoolId,
        ownerId: actor.id,
        kind: rubricDraftJobKind,
        payload: request.value,
      }),
    );
  }
}

/** Runs a rubric draft job through the rubric writer. */
export class RubricDraftHandler implements JobHandler {
  readonly kind = rubricDraftJobKind;

  constructor(private readonly drafter: RubricDrafter) {}

  async handle(job: Job): Promise<Result<DraftJobResult, { readonly code: JobFailure }>> {
    const request = createRubricRequest(job.payload as RubricRequestInput);
    if (!request.ok) return err({ code: 'failed' });
    const draft = await this.drafter.draft(request.value);
    if (!draft.ok) return draft;
    return ok({ request: request.value, draft: draft.value });
  }
}

interface Deps {
  readonly rubrics: RubricRepository;
  readonly jobs: JobQueue;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Where a new rubric starts: the teacher's own grid (a blank one), or their finished draft. */
export type NewRubric = { readonly details: RubricDetails } | { readonly jobId: JobId };

/** Saves a new rubric; from a draft, the teacher has already chosen to keep it. */
export class CreateRubric {
  constructor(private readonly deps: Deps) {}

  async execute(input: { actor: User } & NewRubric): Promise<Result<Rubric, UseCaseError>> {
    const details = await this.startingPoint(input);
    if (!details.ok) return details;
    const rubric = createRubric({
      id: this.deps.ids.next() as RubricId,
      schoolId: input.actor.schoolId,
      teacherId: input.actor.id,
      ...details.value,
      now: this.deps.clock.now(),
    });
    if (!rubric.ok) return rubric;
    await this.deps.rubrics.save(rubric.value);
    return rubric;
  }

  private async startingPoint(
    input: { actor: User } & NewRubric,
  ): Promise<Result<RubricDetails, UseCaseError>> {
    if ('details' in input) return ok(input.details);
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job?.kind !== rubricDraftJobKind || job.status !== 'completed') return fail('not_found');
    const { request, draft } = job.result as DraftJobResult;
    return ok({ ...draft, subject: request.subject, grade: request.grade });
  }
}

export class ListRubrics {
  constructor(private readonly deps: Pick<Deps, 'rubrics'>) {}

  async execute(input: { actor: User }): Promise<Result<readonly Rubric[], UseCaseError>> {
    return ok(await this.deps.rubrics.listByTeacher(input.actor.schoolId, input.actor.id));
  }
}

export class GetRubric {
  constructor(private readonly deps: Pick<Deps, 'rubrics'>) {}

  execute(input: { actor: User; rubricId: RubricId }): Promise<Result<Rubric, UseCaseError>> {
    return findOwned(this.deps.rubrics, input.actor, input.rubricId);
  }
}

/** Replaces the whole grid with the teacher's edits. */
export class UpdateRubric {
  constructor(private readonly deps: Pick<Deps, 'rubrics' | 'clock'>) {}

  async execute(input: {
    actor: User;
    rubricId: RubricId;
    details: RubricDetails;
  }): Promise<Result<Rubric, UseCaseError>> {
    const found = await findOwned(this.deps.rubrics, input.actor, input.rubricId);
    if (!found.ok) return found;
    const updated = updateRubric(found.value, input.details, this.deps.clock.now());
    if (!updated.ok) return updated;
    await this.deps.rubrics.save(updated.value);
    return updated;
  }
}

export class DeleteRubric {
  constructor(private readonly deps: Pick<Deps, 'rubrics'>) {}

  async execute(input: { actor: User; rubricId: RubricId }): Promise<Result<true, UseCaseError>> {
    const found = await findOwned(this.deps.rubrics, input.actor, input.rubricId);
    if (!found.ok) return found;
    await this.deps.rubrics.delete(input.actor.schoolId, input.rubricId);
    return ok(true);
  }
}
