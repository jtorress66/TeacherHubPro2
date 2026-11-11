import { describe, expect, it } from 'vitest';
import {
  parseMarkdown,
  toGoogleSlides,
  type GenerationId,
  type PresentationId,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import {
  aGeneration,
  aUser,
  FakeMicrosoftAuthorization,
  FakeOfficeFiles,
  FakeOneDriveFiles,
  FakeSecretCipher,
  InMemoryMicrosoftConnectionRepository,
} from '@thp/testing';
import {
  CreatePresentation,
  DisconnectMicrosoft,
  FinishMicrosoftConnect,
  MicrosoftConnected,
  SaveGenerationToOneDrive,
  SavePresentationToOneDrive,
  StartMicrosoftConnect,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const pptx = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const redirectUri = 'https://app.test/api/microsoft/callback';

async function teacher(world: World, { connect = true, name = 'Volcanoes' } = {}) {
  const { user: actor } = await signedUp(world);
  const officeFiles = new FakeOfficeFiles();
  const deps = {
    ...world,
    cipher: new FakeSecretCipher(),
    microsoftAuth: new FakeMicrosoftAuthorization(),
    microsoftConnections: new InMemoryMicrosoftConnectionRepository(),
    oneDriveFiles: new FakeOneDriveFiles(),
    officeFiles,
    presentationFiles: officeFiles,
    documentFiles: officeFiles,
  };
  if (connect) {
    valueOf(
      await new FinishMicrosoftConnect(deps).execute({
        actor,
        code: FakeMicrosoftAuthorization.code,
        codeVerifier: FakeMicrosoftAuthorization.verifier,
        redirectUri,
      }),
    );
  }
  const presentation = valueOf(
    await new CreatePresentation(world).execute({ actor, name, theme: 'ocean' }),
  );
  const generation = aGeneration({
    id: 'gen-1' as GenerationId,
    schoolId: actor.schoolId,
    teacherId: actor.id,
    topic: 'Fractions',
    content: '# Fractions\n\n1. Name: ____\n2. **Add** 1/2 + 1/4',
  });
  await world.generations.save(generation);
  return { actor, deps, presentation, generation };
}

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

/** The refresh token kept for the teacher: as stored, and decrypted. */
async function savedToken(deps: Awaited<ReturnType<typeof teacher>>['deps'], actor: User) {
  const sealed = (await deps.microsoftConnections.find(actor.schoolId, actor.id))
    ?.encryptedRefreshToken;
  return { sealed, plain: await deps.cipher.decrypt(sealed ?? '') };
}

describe('Connecting Microsoft', () => {
  it('sends the teacher to Microsoft with the state and the PKCE challenge', () => {
    const url = new URL(
      new StartMicrosoftConnect({ microsoftAuth: new FakeMicrosoftAuthorization() }).execute({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        redirectUri,
      }),
    );
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
  });

  it('keeps the granted access only encrypted, and says the teacher is connected', async () => {
    const { actor, deps } = await teacher(makeWorld());
    const { sealed, plain } = await savedToken(deps, actor);
    expect(sealed).not.toContain('microsoft-refresh-1');
    expect(plain).toEqual({ ok: true, value: 'microsoft-refresh-1' });
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(true);
  });

  it('refuses a code that comes back without its verifier, and keeps nothing', async () => {
    const { actor, deps } = await teacher(makeWorld(), { connect: false });
    expect(
      await new FinishMicrosoftConnect(deps).execute({
        actor,
        code: FakeMicrosoftAuthorization.code,
        codeVerifier: 'stolen',
        redirectUri,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_failed' } });
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(false);
  });

  it('forgets the access when the teacher disconnects', async () => {
    const { actor, deps } = await teacher(makeWorld());
    valueOf(await new DisconnectMicrosoft(deps).execute({ actor }));
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(false);
    expect(await deps.microsoftConnections.find(actor.schoolId, actor.id)).toBeNull();
  });

  it("disconnecting never touches another school's connection", async () => {
    const { actor, deps } = await teacher(makeWorld());
    valueOf(await new DisconnectMicrosoft(deps).execute({ actor: { ...outsider, id: actor.id } }));
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(true);
    expect(
      await new MicrosoftConnected(deps).execute({ actor: { ...outsider, id: actor.id } }),
    ).toBe(false);
  });
});

describe('Saving a presentation to OneDrive', () => {
  it('saves it as a PowerPoint file named after it and returns the link to open it', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());

    expect(
      valueOf(
        await new SavePresentationToOneDrive(deps).execute({
          actor,
          presentationId: presentation.id,
        }),
      ),
    ).toEqual({ webUrl: 'https://onedrive.test/TeacherHubPro/Volcanoes.pptx' });
    expect(deps.officeFiles.decks).toEqual([toGoogleSlides(presentation)]);
    expect(deps.oneDriveFiles.uploads).toEqual([
      { name: 'Volcanoes.pptx', mimeType: pptx, bytes: new TextEncoder().encode('pptx:Volcanoes') },
    ]);
  });

  it('gives the file a name OneDrive accepts', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld(), {
      name: 'Unit 3: Fractions?',
    });
    valueOf(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    );
    expect(deps.oneDriveFiles.uploads[0]?.name).toBe('Unit 3 Fractions.pptx');
  });

  it('keeps the newest refresh token when Microsoft issues one', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    const save = new SavePresentationToOneDrive(deps);

    valueOf(await save.execute({ actor, presentationId: presentation.id }));
    valueOf(await save.execute({ actor, presentationId: presentation.id }));
    expect((await savedToken(deps, actor)).plain).toEqual({
      ok: true,
      value: 'microsoft-refresh-3',
    });
  });

  it('keeps the same refresh token when Microsoft does not issue a new one', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    deps.microsoftAuth.rotates = false;
    const before = await savedToken(deps, actor);

    valueOf(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    );
    expect(await savedToken(deps, actor)).toEqual(before);
    expect(before.plain).toEqual({ ok: true, value: 'microsoft-refresh-1' });
  });

  it('asks to connect first, and forgets an access Microsoft no longer accepts', async () => {
    const notConnected = await teacher(makeWorld(), { connect: false });
    expect(
      await new SavePresentationToOneDrive(notConnected.deps).execute({
        actor: notConnected.actor,
        presentationId: notConnected.presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_not_connected' } });

    const { actor, deps, presentation } = await teacher(makeWorld());
    deps.microsoftAuth.removeApp();
    expect(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_not_connected' } });
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(false);
    expect(deps.oneDriveFiles.uploads).toEqual([]);
  });

  it('forgets a stored token that can no longer be read', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    const saved = await deps.microsoftConnections.find(actor.schoolId, actor.id);
    if (saved === null) throw new Error('not connected');
    await deps.microsoftConnections.save({ ...saved, encryptedRefreshToken: 'damaged' });
    expect(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_not_connected' } });
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(false);
  });

  it('keeps the connection when Microsoft is only busy, so the teacher can try again', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    deps.microsoftAuth.failWith = 'throttled';
    expect(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_failed' } });
    expect(await new MicrosoftConnected(deps).execute({ actor })).toBe(true);
  });

  it('reports a failed upload so the teacher can try again', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    deps.oneDriveFiles.failWith = 'unavailable';
    expect(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_failed' } });
    deps.oneDriveFiles.failWith = 'unauthorized';
    expect(
      await new SavePresentationToOneDrive(deps).execute({
        actor,
        presentationId: presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_not_connected' } });
  });

  it("never sends another teacher's or another school's presentation", async () => {
    const world = makeWorld();
    const { actor, deps, presentation } = await teacher(world);
    const colleague = colleagueOf(actor);
    for (const intruder of [outsider, colleague]) {
      for (const presentationId of [presentation.id, 'missing' as PresentationId]) {
        expect(
          await new SavePresentationToOneDrive(deps).execute({ actor: intruder, presentationId }),
        ).toEqual({ ok: false, error: { code: 'not_found' } });
      }
    }
    expect(deps.oneDriveFiles.uploads).toEqual([]);
  });
});

describe('Saving AI-written material to OneDrive', () => {
  it('saves it as a Word document with its formatting, named after its topic', async () => {
    const { actor, deps, generation } = await teacher(makeWorld());

    expect(
      valueOf(
        await new SaveGenerationToOneDrive(deps).execute({ actor, generationId: generation.id }),
      ),
    ).toEqual({ webUrl: 'https://onedrive.test/TeacherHubPro/Fractions.docx' });
    expect(deps.officeFiles.documents).toEqual([
      { title: 'Fractions', blocks: parseMarkdown(generation.content) },
    ]);
    expect(deps.oneDriveFiles.uploads[0]).toMatchObject({ name: 'Fractions.docx', mimeType: docx });
  });

  it("never sends another teacher's or another school's material", async () => {
    const { actor, deps, generation } = await teacher(makeWorld());
    for (const intruder of [outsider, colleagueOf(actor)]) {
      expect(
        await new SaveGenerationToOneDrive(deps).execute({
          actor: intruder,
          generationId: generation.id,
        }),
      ).toEqual({ ok: false, error: { code: 'not_found' } });
    }
    expect(deps.oneDriveFiles.uploads).toEqual([]);
  });
});
