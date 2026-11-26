import { describe, expect, it } from 'vitest';
import {
  pictureKeyFor,
  picturesOf,
  type GameContent,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import { aUser, pictureSamples } from '@thp/testing';
import {
  AddItemsFromGame,
  CreateGame,
  DeleteGame,
  DuplicateGame,
  GetGamePicture,
  GetLiveGamePicture,
  GetStudentGamePicture,
  IssueLinks,
  JoinLiveSession,
  OpenLiveHost,
  StartLiveSession,
  UpdateGame,
  UploadGamePicture,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, type World } from './world.ts';

const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };
const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

const [photo, drawing] = pictureSamples;
const photoBytes = photo?.bytes ?? new Uint8Array();
const drawingBytes = drawing?.bytes ?? new Uint8Array();

const quizWith = (...pictures: (string | null)[]): GameContent => ({
  kind: 'questions',
  items: pictures.map((id, index) => ({
    prompt: `Where is place ${String(index + 1)}?`,
    options: ['North', 'South'],
    answer: 0,
    ...(id === null ? {} : { picture: { id, alt: `A map of place ${String(index + 1)}` } }),
  })),
});

const upload = async (world: World, actor: User, bytes = photoBytes) =>
  valueOf(await new UploadGamePicture(world).execute({ actor, bytes })).id;

const stored = async (world: World, schoolId: SchoolId, id: string) =>
  (await world.files.get(pictureKeyFor(schoolId, id))).ok;

async function pictureGame(world: World) {
  const setup = await gradedClass(world);
  const map = await upload(world, setup.actor);
  const game = valueOf(
    await new CreateGame(world).execute({
      actor: setup.actor,
      title: 'Puerto Rico',
      mode: 'quiz',
      content: quizWith(map, null, null),
      classId: setup.cls.id,
    }),
  );
  return { ...setup, map, game };
}

describe('UploadGamePicture', () => {
  it('keeps the picture without its location, under the teacher’s school', async () => {
    const world = makeWorld();
    const { actor } = await gradedClass(world);

    const id = await upload(world, actor);

    const file = await world.files.get(pictureKeyFor(actor.schoolId, id));
    expect(file.ok && Array.from(file.value.bytes)).toEqual(Array.from(photo?.cleaned ?? []));
    expect(file.ok && file.value.contentType).toBe('image/jpeg');
    expect(world.pictureCleaner.cleanedTypes).toEqual(['image/jpeg']);
  });

  it('refuses files that are not pictures, and pictures it cannot read', async () => {
    const world = makeWorld();
    const { actor } = await gradedClass(world);
    const send = (bytes: Uint8Array) => new UploadGamePicture(world).execute({ actor, bytes });
    const refused = { ok: false, error: { field: 'picture', code: 'invalid_format' } };

    expect(await send(new TextEncoder().encode('<svg onload="x"/>'))).toEqual(refused);
    expect(await send(photoBytes.slice(0, 12))).toEqual(refused);
  });
});

describe('GetGamePicture', () => {
  it('shows the teacher and their school’s admin a picture the game has', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const get = (actor: User) =>
      new GetGamePicture(world).execute({ actor, gameId: s.game.id, pictureId: s.map });

    expect((await get(s.actor)).ok).toBe(true);
    expect((await get(colleagueOf(s.actor, 'school_admin'))).ok).toBe(true);
    expect(await get(colleagueOf(s.actor))).toEqual(forbidden);
    expect(await get(outsider)).toEqual(notFound);
  });

  it('never opens a stored picture that the game does not have', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const other = await upload(world, s.actor, drawingBytes);

    expect(
      await new GetGamePicture(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        pictureId: other,
      }),
    ).toEqual(notFound);
  });

  it('keeps another school’s pictures out of reach, even when a game names their id', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const theirs = await upload(world, outsider);
    valueOf(
      await new UpdateGame(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        changes: { content: quizWith(s.map, theirs, null) },
      }),
    );

    expect(
      await new GetGamePicture(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        pictureId: theirs,
      }),
    ).toEqual(notFound);
    expect(await stored(world, outsider.schoolId, theirs)).toBe(true);
  });
});

describe('GetStudentGamePicture', () => {
  it('shows the picture on links of the class the game is shared with, and nowhere else', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const links = valueOf(
      await new IssueLinks(world).execute({ actor: s.actor, classId: s.cls.id }),
    );
    const token = links[0]?.token ?? '';
    const get = (pictureId: string) =>
      new GetStudentGamePicture(world).execute({ token, gameId: s.game.id, pictureId });

    expect((await get(s.map)).ok).toBe(true);
    expect(await get('not-in-game')).toEqual(notFound);
    expect(
      (
        await new GetStudentGamePicture(world).execute({
          token: 'made-up',
          gameId: s.game.id,
          pictureId: s.map,
        })
      ).ok,
    ).toBe(false);

    await new UpdateGame(world).execute({
      actor: s.actor,
      gameId: s.game.id,
      changes: { classId: null },
    });
    expect(await get(s.map)).toEqual(notFound);
  });
});

describe('GetLiveGamePicture', () => {
  it('shows the picture to the host and to players holding a ticket for the session', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const session = valueOf(
      await new StartLiveSession(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        classId: s.cls.id,
        kind: 'live',
      }),
    );
    const host = valueOf(
      await new OpenLiveHost(world).execute({ actor: s.actor, sessionId: session.id }),
    ).ticket;
    const player = valueOf(
      await new JoinLiveSession(world).execute({ pin: session.pin, studentId: s.ana.id }),
    ).ticket;
    const get = (ticket: string, pictureId = s.map) =>
      new GetLiveGamePicture(world).execute({ ticket, pictureId });

    expect((await get(host)).ok).toBe(true);
    expect((await get(player)).ok).toBe(true);
    expect(await get(player, 'not-in-game')).toEqual(notFound);
    expect(await get('forged')).toEqual({ ok: false, error: { code: 'unauthenticated' } });
  });
});

describe('picture files follow their game', () => {
  it('deletes a picture’s file when an edit takes it out, and all of them with the game', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const flag = await upload(world, s.actor, drawingBytes);
    valueOf(
      await new UpdateGame(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        changes: { content: quizWith(null, flag, null) },
      }),
    );

    expect(await stored(world, s.actor.schoolId, s.map)).toBe(false);
    expect(await stored(world, s.actor.schoolId, flag)).toBe(true);

    await new DeleteGame(world).execute({ actor: s.actor, gameId: s.game.id });
    expect(await stored(world, s.actor.schoolId, flag)).toBe(false);
  });

  it('gives a duplicate its own copies, so deleting the original keeps the copy’s pictures', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const copy = valueOf(
      await new DuplicateGame(world).execute({ actor: s.actor, gameId: s.game.id, title: 'Copy' }),
    );
    const [copied] = picturesOf(copy.content);

    expect(copied?.id).not.toBe(s.map);
    expect(copied?.alt).toBe('A map of place 1');
    await new DeleteGame(world).execute({ actor: s.actor, gameId: s.game.id });
    const shown = await new GetGamePicture(world).execute({
      actor: s.actor,
      gameId: copy.id,
      pictureId: copied?.id ?? '',
    });
    expect(shown.ok).toBe(true);
  });

  it('copies the pictures that come with items added from another game', async () => {
    const world = makeWorld();
    const s = await pictureGame(world);
    const target = valueOf(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Islands',
        mode: 'quiz',
        content: {
          kind: 'questions',
          items: ['Vieques', 'Culebra', 'Mona'].map((prompt) => ({
            prompt: `${prompt}?`,
            options: ['Yes', 'No'],
            answer: 0,
          })),
        },
      }),
    );

    const added = valueOf(
      await new AddItemsFromGame(world).execute({
        actor: s.actor,
        gameId: target.id,
        sourceId: s.game.id,
      }),
    );

    const [copied] = picturesOf(added.game.content);
    expect(copied?.id).not.toBe(s.map);
    expect(await stored(world, s.actor.schoolId, copied?.id ?? '')).toBe(true);
    expect(await stored(world, s.actor.schoolId, s.map)).toBe(true);
  });
});
