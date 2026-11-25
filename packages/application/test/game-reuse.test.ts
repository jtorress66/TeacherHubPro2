import { describe, expect, it } from 'vitest';
import type { GameContent, SchoolId, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { AddItemsFromGame, CreateGame, DuplicateGame, GetGame } from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const forbidden = { ok: false, error: { code: 'forbidden' } };
const notFound = { ok: false, error: { code: 'not_found' } };

const quiz = (...prompts: string[]): GameContent => ({
  kind: 'questions',
  items: prompts.map((prompt) => ({ prompt, options: [`${prompt}!`, `${prompt}?`], answer: 0 })),
});

async function twoGames(world: World, email?: string) {
  const setup = await gradedClass(world, email);
  const make = async (title: string, content: GameContent, mode = 'quiz') =>
    valueOf(
      await new CreateGame(world).execute({
        actor: setup.actor,
        title,
        mode,
        content,
        classId: setup.cls.id,
      }),
    );
  const planets = await make('Planets', quiz('Mercury', 'Venus', 'Earth'));
  const moons = await make('Moons', quiz('Luna', 'Phobos', 'Earth'));
  return { setup, planets, moons, make };
}

describe('DuplicateGame', () => {
  it('saves an unshared copy with the new title, and leaves the original as it was', async () => {
    const world = makeWorld();
    const { setup, planets } = await twoGames(world);

    const copy = valueOf(
      await new DuplicateGame(world).execute({
        actor: setup.actor,
        gameId: planets.id,
        title: 'Planets (copy)',
      }),
    );

    expect(copy.id).not.toBe(planets.id);
    expect(copy).toMatchObject({
      title: 'Planets (copy)',
      classId: null,
      content: planets.content,
    });
    expect(copy.grading.countAsGrade).toBe(false);
    const original = valueOf(
      await new GetGame(world).execute({ actor: setup.actor, gameId: planets.id }),
    );
    expect(original.game.classId).toBe(setup.cls.id);
  });

  it('lets a school admin copy it, but not another teacher or another school', async () => {
    const world = makeWorld();
    const { setup, planets } = await twoGames(world);
    const duplicate = (actor: typeof setup.actor) =>
      new DuplicateGame(world).execute({ actor, gameId: planets.id, title: 'Copy' });

    expect((await duplicate(colleagueOf(setup.actor, 'school_admin'))).ok).toBe(true);
    expect(await duplicate(colleagueOf(setup.actor))).toEqual(forbidden);
    expect(await duplicate(outsider)).toEqual(notFound);
  });
});

describe('AddItemsFromGame', () => {
  it('adds the other game’s new items to this one and says how many', async () => {
    const world = makeWorld();
    const { setup, planets, moons } = await twoGames(world);

    const result = valueOf(
      await new AddItemsFromGame(world).execute({
        actor: setup.actor,
        gameId: planets.id,
        sourceId: moons.id,
      }),
    );

    expect(result).toMatchObject({ added: 2, skipped: 1 });
    const saved = valueOf(
      await new GetGame(world).execute({ actor: setup.actor, gameId: planets.id }),
    );
    expect(saved.game.content.items).toHaveLength(5);
  });

  it('refuses a game whose items cannot become this game’s kind', async () => {
    const world = makeWorld();
    const { setup, planets, make } = await twoGames(world);
    const order = await make(
      'Seasons in order',
      { kind: 'steps', items: ['Spring', 'Summer', 'Autumn'] },
      'sequence',
    );

    expect(
      await new AddItemsFromGame(world).execute({
        actor: setup.actor,
        gameId: planets.id,
        sourceId: order.id,
      }),
    ).toEqual({ ok: false, error: { field: 'source', code: 'not_allowed' } });
  });

  it("never reads another teacher's or another school's game", async () => {
    const world = makeWorld();
    const { setup, planets } = await twoGames(world);
    const other = await twoGames(world, 'other@school.edu');
    const theirs = valueOf(
      await new CreateGame(world).execute({
        actor: other.setup.actor,
        title: 'Theirs',
        mode: 'quiz',
        content: quiz('One', 'Two', 'Three'),
      }),
    );

    expect(
      await new AddItemsFromGame(world).execute({
        actor: setup.actor,
        gameId: planets.id,
        sourceId: theirs.id,
      }),
    ).toEqual(notFound);
    expect(theirs.schoolId).not.toBe(setup.actor.schoolId);
    expect(
      await new AddItemsFromGame(world).execute({
        actor: colleagueOf(setup.actor),
        gameId: planets.id,
        sourceId: planets.id,
      }),
    ).toEqual(forbidden);
  });
});
