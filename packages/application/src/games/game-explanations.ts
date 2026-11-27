import {
  ok,
  unexplainedItems,
  withExplanations,
  type GameContent,
  type GameId,
  type Job,
  type JobFailure,
  type JobId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  Clock,
  ExplanationWriter,
  GameRepository,
  JobQueue,
  SchoolRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { findOwnGame } from './game-access.ts';

export const gameExplanationsJobKind = 'game.explain';

interface ExplanationsPayload {
  readonly gameId: GameId;
}

/** The game's items with the drafted explanations on the ones that had none, for review. */
export interface ExplanationsDraft {
  readonly gameId: GameId;
  readonly content: GameContent;
}

/**
 * Asks the AI to draft "why this is the answer" for the items of the teacher's own game that
 * have none. Needs AI access. Nothing is saved until the teacher reviews and saves the game.
 */
export class RequestGameExplanations {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly schools: SchoolRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { actor: User; gameId: GameId }): Promise<Result<Job, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    if (unexplainedItems(game.value.content).length === 0) return fail('nothing_to_explain');
    const access = await checkAiAccess(this.deps, input.actor);
    if (!access.ok) return access;
    const payload: ExplanationsPayload = { gameId: game.value.id };
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: input.actor.schoolId,
        ownerId: input.actor.id,
        kind: gameExplanationsJobKind,
        payload,
      }),
    );
  }
}

/**
 * Drafts the explanations from the game as it is when the job runs: only each unexplained item's
 * question, options and right answer, and the game's language, are sent.
 */
export class GameExplanationsHandler implements JobHandler {
  readonly kind = gameExplanationsJobKind;

  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly explanationWriter: ExplanationWriter;
    },
  ) {}

  async handle(job: Job): Promise<Result<ExplanationsDraft, { readonly code: JobFailure }>> {
    const { gameId } = job.payload as ExplanationsPayload;
    const game = await this.deps.games.findById(job.schoolId, gameId);
    if (game === null) return { ok: false, error: { code: 'failed' } };
    const items = unexplainedItems(game.content);
    const explained = await this.deps.explanationWriter.explain({
      language: game.language,
      items,
    });
    if (!explained.ok) return explained;
    const drafted = new Map(
      items.flatMap((item, index) => {
        const text = explained.value[index];
        return text === undefined ? [] : [[item.index, text] as const];
      }),
    );
    return ok({ gameId: game.id, content: withExplanations(game.content, drafted) });
  }
}

/** The actor's finished explanations draft, for the editor to show before saving. */
export class GetExplanationsDraft {
  constructor(private readonly deps: { readonly jobs: JobQueue }) {}

  async execute(input: {
    actor: User;
    jobId: JobId;
  }): Promise<Result<ExplanationsDraft, UseCaseError>> {
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job?.kind !== gameExplanationsJobKind || job.status !== 'completed') {
      return fail('not_found');
    }
    return ok(job.result as ExplanationsDraft);
  }
}
