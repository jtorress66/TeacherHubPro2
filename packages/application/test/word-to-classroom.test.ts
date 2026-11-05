import { describe, expect, it } from 'vitest';
import { maxAttachmentBytes } from '@thp/domain';
import {
  FakeClassroom,
  FakeClassroomAuthorization,
  FakeGoogleDrive,
  FakeSecretCipher,
} from '@thp/testing';
import { FinishClassroomConnect, PostWordToClassroom } from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

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
  const post = (changes: Partial<Parameters<PostWordToClassroom['execute']>[0]> = {}) =>
    new PostWordToClassroom(all).execute({
      actor,
      courseId: 'course-1',
      title: 'Unit 3 test',
      instructions: 'Type your answers in the document.',
      dueDate: '2026-12-01',
      fileName: 'unit-3.docx',
      bytes: docx,
      ...changes,
    });
  return { classroom, drive, post };
}

describe('Posting a Word document to Google Classroom', () => {
  it('uploads the document as it is and posts it so each student gets a copy', async () => {
    const world = makeWorld();
    const { classroom, drive, post } = await teacher(world);

    const posted = valueOf(await post());

    expect(posted).toEqual({
      url: expect.stringContaining('classroom.test') as string,
      docUrl: 'https://docs.test/doc-1/edit',
    });
    expect(drive.uploads).toEqual([{ name: 'unit-3.docx', bytes: docx }]);
    expect(classroom.coursework.at(-1)).toEqual({
      title: 'Unit 3 test',
      description: 'Type your answers in the document.',
      material: { kind: 'driveFile', driveFileId: 'doc-1', shareMode: 'copy' },
      dueDate: '2026-12-01',
    });
  });

  it('checks the course, title, file and due date before calling Google', async () => {
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
    expect(await post({ fileName: 'unit-3.pdf' })).toEqual({
      ok: false,
      error: { field: 'file', code: 'not_allowed' },
    });
    expect(await post({ bytes: new TextEncoder().encode('%PDF') })).toEqual({
      ok: false,
      error: { field: 'file', code: 'invalid_format' },
    });
    const big = new Uint8Array(maxAttachmentBytes + 1);
    big.set([0x50, 0x4b]);
    expect(await post({ bytes: big })).toEqual({
      ok: false,
      error: { field: 'file', code: 'too_large' },
    });
    expect(await post({ dueDate: '12/01/2026' })).toEqual({
      ok: false,
      error: { field: 'dueDate', code: 'invalid_format' },
    });
    expect(drive.uploads).toEqual([]);
  });

  it('needs a Google connection', async () => {
    const world = makeWorld();
    const { post } = await teacher(world, { connect: false });
    expect(await post()).toEqual({ ok: false, error: { code: 'classroom_not_connected' } });
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

  it('reports an unknown course', async () => {
    const { post } = await teacher(makeWorld());
    expect(await post({ courseId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'classroom_failed' },
    });
  });
});
