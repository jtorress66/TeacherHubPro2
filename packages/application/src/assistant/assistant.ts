import {
  createContentRequest,
  createGeneration,
  err,
  ok,
  type AiGeneration,
  type ContentRequestInput,
  type GenerationId,
  type Job,
  type JobFailure,
  type Result,
  type GenerationSummary,
  type User,
} from '@thp/domain';
import type {
  AiGenerationRepository,
  Clock,
  ContentWriter,
  IdGenerator,
  JobQueue,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import type { UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { findOwned } from './owned.ts';

export const generationJobKind = 'assistant.generate';

/** What a generation job stores once done: where the saved content is. */
export interface GenerationJobResult {
  readonly generationId: GenerationId;
}

/**
 * Queues the AI assistant writing a worksheet, quiz, summary, activities or lesson plan. Needs an
 * active subscription or trial; the job holds only the request, never student data.
 */
export class RequestGeneration {
  constructor(
    private readonly deps: {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { actor: User } & ContentRequestInput): Promise<Result<Job, UseCaseError>> {
    const { actor, ...details } = input;
    const access = await checkAiAccess(this.deps, actor.schoolId);
    if (!access.ok) return access;
    const request = createContentRequest(details);
    if (!request.ok) return request;
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: actor.schoolId,
        ownerId: actor.id,
        kind: generationJobKind,
        payload: request.value,
      }),
    );
  }
}

/** Runs a generation job through the content writer and keeps the result in the history. */
export class GenerationHandler implements JobHandler {
  readonly kind = generationJobKind;

  constructor(
    private readonly deps: {
      readonly writer: ContentWriter;
      readonly generations: AiGenerationRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async handle(job: Job): Promise<Result<GenerationJobResult, { readonly code: JobFailure }>> {
    const request = createContentRequest(job.payload as ContentRequestInput);
    if (!request.ok) return err({ code: 'failed' });
    const content = await this.deps.writer.write(request.value);
    if (!content.ok) return content;
    const generation = createGeneration({
      id: this.deps.ids.next() as GenerationId,
      schoolId: job.schoolId,
      teacherId: job.ownerId,
      request: request.value,
      content: content.value,
      createdAt: this.deps.clock.now(),
    });
    if (!generation.ok) return err({ code: 'invalid_output' });
    await this.deps.generations.save(generation.value);
    return ok({ generationId: generation.value.id });
  }
}

interface Generations {
  readonly generations: AiGenerationRepository;
}

/** The teacher's own history, newest first. */
export class ListGenerations {
  constructor(private readonly deps: Generations) {}

  async execute(input: {
    actor: User;
  }): Promise<Result<readonly GenerationSummary[], UseCaseError>> {
    return ok(await this.deps.generations.listByTeacher(input.actor.schoolId, input.actor.id));
  }
}

export class GetGeneration {
  constructor(private readonly deps: Generations) {}

  execute(input: {
    actor: User;
    generationId: GenerationId;
  }): Promise<Result<AiGeneration, UseCaseError>> {
    return findOwned(this.deps.generations, input.actor, input.generationId);
  }
}

export class DeleteGeneration {
  constructor(private readonly deps: Generations) {}

  async execute(input: {
    actor: User;
    generationId: GenerationId;
  }): Promise<Result<true, UseCaseError>> {
    const generation = await findOwned(this.deps.generations, input.actor, input.generationId);
    if (!generation.ok) return generation;
    await this.deps.generations.delete(input.actor.schoolId, input.generationId);
    return ok(true);
  }
}
