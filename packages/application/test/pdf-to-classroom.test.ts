import { describe, expect, it } from 'vitest';
import { maxAttachmentBytes } from '@thp/domain';
import {
  FakeClassroom,
  FakeClassroomAuthorization,
  FakeGoogleDrive,
  FakeSecretCipher,
} from '@thp/testing';
import { FinishClassroomConnect, PostPdfToClassroom } from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const pdf = new TextEncoder().encode('%PDF unit test');

async function teacher(world: World, { connect = true, drive = new FakeGoogleDrive() } = {}) {
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
    googleDrive: drive,
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
  const post = (changes: Partial<Parameters<PostPdfToClassroom['execute']>[0]> = {}) =>
    new PostPdfToClassroom(all).execute({
      actor,
      courseId: 'course-1',
      title: 'Unit 3 test',
      instructions: 'Write your answers on the PDF.',
      dueDate: '2026-12-01',
      fileName: 'unit-3.pdf',
      pdf,
      ...changes,
    });
  return { classroom, drive, post };
}

describe('Posting a test PDF straight to Google Classroom', () => {
  it('uploads the PDF to Drive and posts it so each student gets a copy', async () => {
    const world = makeWorld();
    const { classroom, drive, post } = await teacher(world);

    const posted = valueOf(await post());

    expect(posted.url).toContain('classroom.test');
    expect(drive.uploads).toEqual([{ name: 'unit-3.pdf', bytes: pdf }]);
    expect(classroom.coursework.at(-1)).toEqual({
      title: 'Unit 3 test',
      description: 'Write your answers on the PDF.',
      material: { kind: 'pdf', driveFileId: 'drive-1' },
      dueDate: '2026-12-01',
    });
  });

  it('names the upload after the title when the file has no name', async () => {
    const world = makeWorld();
    const { drive, post } = await teacher(world);
    valueOf(await post({ fileName: ' ', instructions: null, dueDate: null }));
    expect(drive.uploads[0]?.name).toBe('Unit 3 test.pdf');
  });

  it('checks the title, the PDF and the due date before calling Google', async () => {
    const world = makeWorld();
    const { drive, post } = await teacher(world);
    expect(await post({ courseId: ' ' })).toEqual({
      ok: false,
      error: { field: 'courseId', code: 'required' },
    });
    expect(await post({ title: ' ' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(await post({ pdf: new Uint8Array() })).toEqual({
      ok: false,
      error: { field: 'pdf', code: 'too_large' },
    });
    expect(await post({ pdf: new Uint8Array(maxAttachmentBytes + 1) })).toEqual({
      ok: false,
      error: { field: 'pdf', code: 'too_large' },
    });
    expect(await post({ dueDate: '12/01/2026' })).toEqual({
      ok: false,
      error: { field: 'dueDate', code: 'invalid_format' },
    });
    expect(drive.uploads).toEqual([]);
  });

  it('names the fix when Google refuses: an API turned off, or a grant missing Drive', async () => {
    const off = await teacher(makeWorld(), {
      drive: new FakeGoogleDrive({ accessToken: 'classroom-access', failWith: 'api_disabled' }),
    });
    expect(await off.post()).toEqual({ ok: false, error: { code: 'google_api_disabled' } });

    const old = await teacher(makeWorld(), {
      drive: new FakeGoogleDrive({
        accessToken: 'classroom-access',
        failWith: 'insufficient_scope',
      }),
    });
    expect(await old.post()).toEqual({ ok: false, error: { code: 'google_reconnect' } });
    expect(old.classroom.coursework).toEqual([]);
  });

  it('needs a Google connection', async () => {
    const world = makeWorld();
    const { post } = await teacher(world, { connect: false });
    expect(await post()).toEqual({ ok: false, error: { code: 'classroom_not_connected' } });
  });

  it('posts nothing when the upload fails, and reports an unknown course', async () => {
    const world = makeWorld();
    const failing = await teacher(world, {
      drive: new FakeGoogleDrive({ accessToken: 'someone-else' }),
    });
    expect(await failing.post()).toEqual({ ok: false, error: { code: 'classroom_failed' } });
    expect(failing.classroom.coursework).toEqual([]);

    const other = await teacher(makeWorld());
    expect(await other.post({ courseId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'classroom_failed' },
    });
  });
});
