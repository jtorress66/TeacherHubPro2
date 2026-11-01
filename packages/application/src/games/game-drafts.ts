import {
  contentLabels,
  createGameRequest,
  ok,
  type GameContent,
  type GameId,
  type GameRequest,
  type Job,
  type JobFailure,
  type JobId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  Clock,
  GameRepository,
  GameWriter,
  JobQueue,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { findOwnGame } from './game-access.ts';

export const gameDraftJobKind = 'game.generate';

/** What a finished draft offers the teacher to review: new content, or fresh items for a game. */
export interface GameDraft {
  readonly content: GameContent;
  readonly request: GameRequest;
  readonly gameId: GameId | null;
}

interface GameDraftPayload {
  readonly request: GameRequest;
  readonly gameId: GameId | null;
}

export interface GameDraftInput {
  readonly actor: User;
  readonly kind: string;
  readonly subject: string;
  readonly grade: string;
  readonly topic: string;
  readonly count?: number;
  readonly language?: string;
  /** Fresh items for this game: its kind, avoiding the items it has. */
  readonly gameId?: GameId;
}

/**
 * Asks the AI to write game content. Needs AI access; only the topic, subject, grade and
 * language are sent. Nothing is saved until the teacher reviews the draft.
 */
export class RequestGameDraft {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: GameDraftInput): Promise<Result<Job, UseCaseError>> {
    const access = await checkAiAccess(this.deps, input.actor.schoolId);
    if (!access.ok) return access;
    let kind = input.kind;
    let avoid: string[] = [];
    if (input.gameId !== undefined) {
      const game = await findOwnGame(this.deps.games, { actor: input.actor, gameId: input.gameId });
      if (!game.ok) return game;
      kind = game.value.content.kind;
      avoid = contentLabels(game.value.content);
    }
    const request = createGameRequest({
      kind,
      subject: input.subject,
      grade: input.grade,
      topic: input.topic,
      language: input.language ?? input.actor.language,
      avoid,
      ...(input.count === undefined ? {} : { count: input.count }),
    });
    if (!request.ok) return request;
    const payload: GameDraftPayload = { request: request.value, gameId: input.gameId ?? null };
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: input.actor.schoolId,
        ownerId: input.actor.id,
        kind: gameDraftJobKind,
        payload,
      }),
    );
  }
}

export class GameDraftHandler implements JobHandler {
  readonly kind = gameDraftJobKind;

  constructor(private readonly deps: { readonly gameWriter: GameWriter }) {}

  async handle(job: Job): Promise<Result<GameDraft, { readonly code: JobFailure }>> {
    const payload = job.payload as GameDraftPayload;
    const content = await this.deps.gameWriter.write(payload.request);
    if (!content.ok) return content;
    return ok({ content: content.value, request: payload.request, gameId: payload.gameId });
  }
}

/** The actor's finished draft, for the editor to show before saving. */
export class GetGameDraft {
  constructor(private readonly deps: { readonly jobs: JobQueue }) {}

  async execute(input: { actor: User; jobId: JobId }): Promise<Result<GameDraft, UseCaseError>> {
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job?.kind !== gameDraftJobKind || job.status !== 'completed') return fail('not_found');
    return ok(job.result as GameDraft);
  }
}
