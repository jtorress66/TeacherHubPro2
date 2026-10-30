import {
  blankSlide,
  createPresentation,
  createPresentationRequest,
  err,
  ok,
  updatePresentation,
  type Job,
  type JobFailure,
  type JobId,
  type Presentation,
  type PresentationDetails,
  type PresentationDraft,
  type PresentationId,
  type PresentationRequest,
  type PresentationRequestInput,
  type Result,
  type PresentationSummary,
  type User,
} from '@thp/domain';
import type {
  Clock,
  IdGenerator,
  JobQueue,
  PresentationDrafter,
  PresentationRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { findOwned } from '../assistant/owned.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';

export const presentationDraftJobKind = 'presentation.draft';

/** What a slide draft job stores: the request it answered and the AI's slides. */
interface DraftJobResult {
  readonly request: PresentationRequest;
  readonly draft: PresentationDraft;
}

/** Queues an AI draft of slides. Needs an active subscription or trial; no student data. */
export class RequestPresentationDraft {
  constructor(
    private readonly deps: {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(
    input: { actor: User } & PresentationRequestInput,
  ): Promise<Result<Job, UseCaseError>> {
    const { actor, ...details } = input;
    const access = await checkAiAccess(this.deps, actor.schoolId);
    if (!access.ok) return access;
    const request = createPresentationRequest(details);
    if (!request.ok) return request;
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: actor.schoolId,
        ownerId: actor.id,
        kind: presentationDraftJobKind,
        payload: request.value,
      }),
    );
  }
}

/** Runs a slide draft job through the presentation writer. */
export class PresentationDraftHandler implements JobHandler {
  readonly kind = presentationDraftJobKind;

  constructor(private readonly drafter: PresentationDrafter) {}

  async handle(job: Job): Promise<Result<DraftJobResult, { readonly code: JobFailure }>> {
    const request = createPresentationRequest(job.payload as PresentationRequestInput);
    if (!request.ok) return err({ code: 'failed' });
    const draft = await this.drafter.draft(request.value);
    if (!draft.ok) return draft;
    return ok({ request: request.value, draft: draft.value });
  }
}

interface Deps {
  readonly presentations: PresentationRepository;
  readonly jobs: JobQueue;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Where a new presentation starts: blank (a name and theme), or the actor's finished draft. */
export type NewPresentation =
  { readonly name: string; readonly theme?: string } | { readonly jobId: JobId };

/** Saves a new presentation; from a draft, the teacher has already chosen to keep it. */
export class CreatePresentation {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: { actor: User } & NewPresentation,
  ): Promise<Result<Presentation, UseCaseError>> {
    const details = await this.startingPoint(input);
    if (!details.ok) return details;
    const presentation = createPresentation({
      id: this.deps.ids.next() as PresentationId,
      schoolId: input.actor.schoolId,
      teacherId: input.actor.id,
      ...details.value,
      now: this.deps.clock.now(),
    });
    if (!presentation.ok) return presentation;
    await this.deps.presentations.save(presentation.value);
    return presentation;
  }

  private async startingPoint(
    input: { actor: User } & NewPresentation,
  ): Promise<Result<PresentationDetails, UseCaseError>> {
    if (!('jobId' in input)) {
      return ok({
        name: input.name,
        ...(input.theme === undefined ? {} : { theme: input.theme }),
        slides: [blankSlide('title', input.name)],
      });
    }
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job?.kind !== presentationDraftJobKind || job.status !== 'completed') {
      return fail('not_found');
    }
    const { request, draft } = job.result as DraftJobResult;
    return ok({
      name: draft.title,
      topic: request.topic,
      subject: request.subject,
      grade: request.grade,
      theme: request.theme,
      slides: draft.slides,
    });
  }
}

export class ListPresentations {
  constructor(private readonly deps: Pick<Deps, 'presentations'>) {}

  async execute(input: {
    actor: User;
  }): Promise<Result<readonly PresentationSummary[], UseCaseError>> {
    return ok(await this.deps.presentations.listByTeacher(input.actor.schoolId, input.actor.id));
  }
}

export class GetPresentation {
  constructor(private readonly deps: Pick<Deps, 'presentations'>) {}

  execute(input: {
    actor: User;
    presentationId: PresentationId;
  }): Promise<Result<Presentation, UseCaseError>> {
    return findOwned(this.deps.presentations, input.actor, input.presentationId);
  }
}

/** Changes any of the details or the slides; what is left out stays as it was. */
export class UpdatePresentation {
  constructor(private readonly deps: Pick<Deps, 'presentations' | 'clock'>) {}

  async execute(input: {
    actor: User;
    presentationId: PresentationId;
    changes: Partial<PresentationDetails>;
  }): Promise<Result<Presentation, UseCaseError>> {
    const found = await findOwned(this.deps.presentations, input.actor, input.presentationId);
    if (!found.ok) return found;
    const current = found.value;
    const updated = updatePresentation(
      current,
      {
        name: current.name,
        topic: current.topic,
        subject: current.subject,
        grade: current.grade,
        theme: current.theme,
        slides: current.slides,
        ...input.changes,
      },
      this.deps.clock.now(),
    );
    if (!updated.ok) return updated;
    await this.deps.presentations.save(updated.value);
    return updated;
  }
}

export class DeletePresentation {
  constructor(private readonly deps: Pick<Deps, 'presentations'>) {}

  async execute(input: {
    actor: User;
    presentationId: PresentationId;
  }): Promise<Result<true, UseCaseError>> {
    const found = await findOwned(this.deps.presentations, input.actor, input.presentationId);
    if (!found.ok) return found;
    await this.deps.presentations.delete(input.actor.schoolId, input.presentationId);
    return ok(true);
  }
}
