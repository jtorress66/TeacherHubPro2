import { describe, expect, it } from 'vitest';
import type { GameContent, JobId } from '@thp/domain';
import { FakeExplanationWriter, sampleGameContent } from '@thp/testing';
import {
  CreateGame,
  GameExplanationsHandler,
  GetExplanationsDraft,
  RequestGameExplanations,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

const forbidden = { ok: false, error: { code: 'forbidden' } };
const notFound = { ok: false, error: { code: 'not_found' } };
const jupiter = 'Jupiter is more massive than all the other planets together.';

async function setUp(world: World, content: GameContent = sampleGameContent.questions) {
  const setup = await gradedClass(world);
  const game = valueOf(
    await new CreateGame(world).execute({
      actor: setup.actor,
      title: 'Planets',
      mode: content.kind === 'questions' ? 'quiz' : 'flashcards',
      content,
      classId: setup.cls.id,
    }),
  );
  return { ...setup, game };
}

/** Runs the queued explanation job the way the worker does. */
async function runJob(world: World) {
  const claimed = await world.jobs.claimNext(['game.explain']);
  if (claimed === null) throw new Error('no job');
  const result = await new GameExplanationsHandler(world).handle(claimed);
  if (result.ok) await world.jobs.complete(claimed.id, result.value);
  return result;
}

describe('Games: AI explanations for an existing game', () => {
  it('sends only the unexplained items, in the game’s language, and keeps the teacher’s own', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const job = valueOf(
      await new RequestGameExplanations(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    expect(job.kind).toBe('game.explain');
    valueOf(await runJob(world));

    const [sent] = world.explanationWriter.requests;
    expect(sent?.language).toBe(s.game.language);
    expect(sent?.items.map((item) => item.index)).toEqual([1, 2, 3]);
    expect(sent?.items[0]).toEqual({
      index: 1,
      question: 'Which planet is closest to the Sun?',
      options: ['Mercury', 'Earth'],
      answer: 'Mercury',
    });
    expect(JSON.stringify(sent)).not.toContain('Zayas');

    const draft = valueOf(
      await new GetExplanationsDraft(world).execute({ actor: s.actor, jobId: job.id }),
    );
    expect(draft.gameId).toBe(s.game.id);
    expect(draft.content.items[0]).toMatchObject({ explanation: jupiter });
    expect(draft.content.items[1]).toMatchObject({
      explanation: 'Why Mercury answers “Which planet is closest to the Sun?”.',
    });
    // Nothing is saved until the teacher saves the reviewed game.
    const saved = await world.games.findById(s.actor.schoolId, s.game.id);
    expect(saved?.content.items[1]).not.toHaveProperty('explanation');
  });

  it('only the game’s own teacher may ask, or open the draft', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const colleague = colleagueOf(s.actor);
    expect(
      await new RequestGameExplanations(world).execute({ actor: colleague, gameId: s.game.id }),
    ).toEqual(forbidden);
    const job = valueOf(
      await new RequestGameExplanations(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    valueOf(await runJob(world));
    expect(
      await new GetExplanationsDraft(world).execute({ actor: colleague, jobId: job.id }),
    ).toEqual(notFound);
    expect(
      await new GetExplanationsDraft(world).execute({ actor: s.actor, jobId: 'job-x' as JobId }),
    ).toEqual(notFound);
  });

  it('refuses a game with nothing left to explain', async () => {
    const world = makeWorld();
    const pairs = await setUp(world, sampleGameContent.pairs);
    expect(
      await new RequestGameExplanations(world).execute({
        actor: pairs.actor,
        gameId: pairs.game.id,
      }),
    ).toEqual({ ok: false, error: { code: 'nothing_to_explain' } });
  });

  it('needs AI access', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    advanceDays(world, 8);
    expect(
      await new RequestGameExplanations(world).execute({ actor: s.actor, gameId: s.game.id }),
    ).toEqual({ ok: false, error: { code: 'subscription_required' } });
  });

  it('a failed draft fails the job', async () => {
    const world = { ...makeWorld(), explanationWriter: new FakeExplanationWriter('ai_unavailable') };
    const s = await setUp(world);
    valueOf(
      await new RequestGameExplanations(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    expect(await runJob(world)).toEqual({ ok: false, error: { code: 'ai_unavailable' } });
  });
});
