import { describe, expect, it } from 'vitest';
import { toGoogleSlides, type PresentationId, type SchoolId, type UserId } from '@thp/domain';
import {
  aUser,
  FakeClassroom,
  FakeClassroomAuthorization,
  FakeGoogleSlides,
  FakeSecretCipher,
} from '@thp/testing';
import {
  CreatePresentation,
  FinishClassroomConnect,
  SendPresentationToClassroom,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

async function teacher(world: World, { connect = true, slides = new FakeGoogleSlides() } = {}) {
  const { user: actor } = await signedUp(world);
  const classroom = new FakeClassroom({
    accessToken: 'classroom-access',
    course: { id: 'course-1', name: 'Science 5', section: null },
    roster: [],
  });
  const all = {
    ...world,
    cipher: new FakeSecretCipher(),
    classroomAuth: new FakeClassroomAuthorization(),
    classroomCoursework: classroom,
    googleSlides: slides,
  };
  if (connect) {
    valueOf(
      await new FinishClassroomConnect(all).execute({
        actor,
        code: 'classroom-code',
        redirectUri: 'https://app.test/api/classroom/callback',
      }),
    );
  }
  const presentation = valueOf(
    await new CreatePresentation(world).execute({ actor, name: 'Volcanoes', theme: 'ocean' }),
  );
  const send = (changes: Partial<Parameters<SendPresentationToClassroom['execute']>[0]> = {}) =>
    new SendPresentationToClassroom(all).execute({
      actor,
      presentationId: presentation.id,
      courseId: 'course-1',
      title: 'Volcano slides',
      instructions: 'Look through these before Friday.',
      dueDate: '2026-12-01',
      ...changes,
    });
  return { actor, classroom, slides, presentation, send };
}

describe('Sending a presentation to Google Classroom', () => {
  it('makes a Google Slides deck from it and posts it for everyone to view', async () => {
    const { classroom, slides, presentation, send } = await teacher(makeWorld());

    expect(valueOf(await send())).toEqual({
      url: expect.stringContaining('classroom.test') as string,
      slidesUrl: 'https://slides.test/slides-1/edit',
    });
    expect(slides.decks).toEqual([toGoogleSlides(presentation)]);
    expect(classroom.coursework.at(-1)).toEqual({
      title: 'Volcano slides',
      description: 'Look through these before Friday.',
      material: { kind: 'driveFile', driveFileId: 'slides-1', shareMode: 'view' },
      dueDate: '2026-12-01',
    });
  });

  it('posts without instructions or a due date', async () => {
    const { classroom, send } = await teacher(makeWorld());
    valueOf(await send({ instructions: null, dueDate: null }));
    expect(classroom.coursework.at(-1)).toMatchObject({ description: '', dueDate: null });
  });

  it('checks the course, title, instructions and due date before calling Google', async () => {
    const { slides, send } = await teacher(makeWorld());
    expect(await send({ courseId: ' ' })).toEqual({
      ok: false,
      error: { field: 'courseId', code: 'required' },
    });
    expect(await send({ title: ' ' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(await send({ instructions: 'x'.repeat(5001) })).toEqual({
      ok: false,
      error: { field: 'instructions', code: 'too_long' },
    });
    expect(await send({ dueDate: '12/01/2026' })).toEqual({
      ok: false,
      error: { field: 'dueDate', code: 'invalid_format' },
    });
    expect(slides.decks).toEqual([]);
  });

  it("never sends a colleague's or another school's presentation", async () => {
    const { actor, slides, send } = await teacher(makeWorld());
    expect(await send({ actor: outsider })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect((await send({ actor: colleagueOf(actor) })).ok).toBe(false);
    expect(await send({ presentationId: 'nope' as PresentationId })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(slides.decks).toEqual([]);
  });

  it('needs a Google connection, and names the fix when Google refuses', async () => {
    const offline = await teacher(makeWorld(), { connect: false });
    expect(await offline.send()).toEqual({ ok: false, error: { code: 'classroom_not_connected' } });

    const off = await teacher(makeWorld(), {
      slides: new FakeGoogleSlides({ accessToken: 'classroom-access', failWith: 'api_disabled' }),
    });
    expect(await off.send()).toEqual({ ok: false, error: { code: 'google_api_disabled' } });
    expect(off.classroom.coursework).toEqual([]);

    const old = await teacher(makeWorld(), {
      slides: new FakeGoogleSlides({
        accessToken: 'classroom-access',
        failWith: 'insufficient_scope',
      }),
    });
    expect(await old.send()).toEqual({ ok: false, error: { code: 'google_reconnect' } });
  });

  it('reports an unknown course', async () => {
    const { send } = await teacher(makeWorld());
    expect(await send({ courseId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'classroom_failed' },
    });
  });
});
