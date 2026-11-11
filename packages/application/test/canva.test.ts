import { describe, expect, it } from 'vitest';
import {
  parseMarkdown,
  toGoogleSlides,
  type GenerationId,
  type PresentationId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import {
  aGeneration,
  aUser,
  FakeCanvaAuthorization,
  FakeCanvaDesigns,
  FakeOfficeFiles,
  FakeSecretCipher,
  InMemoryCanvaConnectionRepository,
} from '@thp/testing';
import {
  CanvaConnected,
  CreatePresentation,
  DisconnectCanva,
  DownloadPresentationFile,
  FinishCanvaConnect,
  SendGenerationToCanva,
  SendPresentationToCanva,
  StartCanvaConnect,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const pptx = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const redirectUri = 'https://app.test/api/canva/callback';

async function teacher(world: World, { connect = true } = {}) {
  const { user: actor } = await signedUp(world);
  const officeFiles = new FakeOfficeFiles();
  const deps = {
    ...world,
    cipher: new FakeSecretCipher(),
    canvaAuth: new FakeCanvaAuthorization(),
    canvaConnections: new InMemoryCanvaConnectionRepository(),
    canvaDesigns: new FakeCanvaDesigns(),
    officeFiles,
    presentationFiles: officeFiles,
    documentFiles: officeFiles,
  };
  if (connect) {
    valueOf(
      await new FinishCanvaConnect(deps).execute({
        actor,
        code: FakeCanvaAuthorization.code,
        codeVerifier: FakeCanvaAuthorization.verifier,
        redirectUri,
      }),
    );
  }
  const presentation = valueOf(
    await new CreatePresentation(world).execute({ actor, name: 'Volcanoes', theme: 'ocean' }),
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

describe('Connecting Canva', () => {
  it('sends the teacher to Canva with the state and the PKCE challenge', () => {
    const url = new URL(
      new StartCanvaConnect({ canvaAuth: new FakeCanvaAuthorization() }).execute({
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
    const saved = await deps.canvaConnections.find(actor.schoolId, actor.id);
    expect(saved?.encryptedRefreshToken).not.toContain('canva-refresh-1');
    expect(await deps.cipher.decrypt(saved?.encryptedRefreshToken ?? '')).toEqual({
      ok: true,
      value: 'canva-refresh-1',
    });
    expect(await new CanvaConnected(deps).execute({ actor })).toBe(true);
  });

  it('refuses a code that comes back without its verifier, and keeps nothing', async () => {
    const { actor, deps } = await teacher(makeWorld(), { connect: false });
    expect(
      await new FinishCanvaConnect(deps).execute({
        actor,
        code: FakeCanvaAuthorization.code,
        codeVerifier: 'stolen',
        redirectUri,
      }),
    ).toEqual({ ok: false, error: { code: 'canva_failed' } });
    expect(await new CanvaConnected(deps).execute({ actor })).toBe(false);
  });

  it('cancels the access at Canva and forgets it when the teacher disconnects', async () => {
    const { actor, deps } = await teacher(makeWorld());
    valueOf(await new DisconnectCanva(deps).execute({ actor }));
    expect(await new CanvaConnected(deps).execute({ actor })).toBe(false);
    expect(await deps.canvaAuth.refresh('canva-refresh-1')).toEqual({
      ok: false,
      error: { code: 'unauthorized' },
    });
    expect(deps.canvaAuth.revoked).toEqual(['canva-refresh-1']);
  });

  it('still forgets the access when Canva cannot be reached to cancel it', async () => {
    const { actor, deps } = await teacher(makeWorld());
    deps.canvaAuth.revokeFails = true;
    valueOf(await new DisconnectCanva(deps).execute({ actor }));
    expect(await new CanvaConnected(deps).execute({ actor })).toBe(false);
  });
});

describe('Sending a presentation to Canva', () => {
  it('imports it as a PowerPoint file and returns the link to edit it in Canva', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());

    expect(
      valueOf(
        await new SendPresentationToCanva(deps).execute({ actor, presentationId: presentation.id }),
      ),
    ).toEqual({ editUrl: 'https://canva.test/design/D1/edit' });
    expect(deps.officeFiles.decks).toEqual([toGoogleSlides(presentation)]);
    expect(deps.canvaDesigns.imports).toEqual([
      { title: 'Volcanoes', mimeType: pptx, bytes: new TextEncoder().encode('pptx:Volcanoes') },
    ]);
  });

  it('keeps the newest refresh token, since Canva replaces it at every use', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    const send = new SendPresentationToCanva(deps);

    valueOf(await send.execute({ actor, presentationId: presentation.id }));
    valueOf(await send.execute({ actor, presentationId: presentation.id }));
    const saved = await deps.canvaConnections.find(actor.schoolId, actor.id);
    expect(await deps.cipher.decrypt(saved?.encryptedRefreshToken ?? '')).toEqual({
      ok: true,
      value: 'canva-refresh-3',
    });
  });

  it('asks to connect first, and forgets an access Canva no longer accepts', async () => {
    const notConnected = await teacher(makeWorld(), { connect: false });
    expect(
      await new SendPresentationToCanva(notConnected.deps).execute({
        actor: notConnected.actor,
        presentationId: notConnected.presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'canva_not_connected' } });

    const { actor, deps, presentation } = await teacher(makeWorld());
    const saved = await deps.canvaConnections.find(actor.schoolId, actor.id);
    if (saved === null) throw new Error('not connected');
    await deps.canvaConnections.save({
      ...saved,
      encryptedRefreshToken: await deps.cipher.encrypt('revoked'),
    });
    expect(
      await new SendPresentationToCanva(deps).execute({ actor, presentationId: presentation.id }),
    ).toEqual({ ok: false, error: { code: 'canva_not_connected' } });
    expect(await new CanvaConnected(deps).execute({ actor })).toBe(false);
  });

  it('reports a failed import so the teacher can try again', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld());
    deps.canvaDesigns.failWith = 'invalid_file';
    expect(
      await new SendPresentationToCanva(deps).execute({ actor, presentationId: presentation.id }),
    ).toEqual({ ok: false, error: { code: 'canva_failed' } });
  });

  it("never sends another teacher's or another school's presentation", async () => {
    const { deps, presentation } = await teacher(makeWorld());
    for (const presentationId of [presentation.id, 'missing' as PresentationId]) {
      expect(
        await new SendPresentationToCanva(deps).execute({ actor: outsider, presentationId }),
      ).toEqual({ ok: false, error: { code: 'not_found' } });
    }
    expect(deps.canvaDesigns.imports).toEqual([]);
  });
});

describe('Sending AI-written material to Canva', () => {
  it('imports it as a Word document with its formatting, titled by its topic', async () => {
    const { actor, deps, generation } = await teacher(makeWorld());

    expect(
      valueOf(
        await new SendGenerationToCanva(deps).execute({ actor, generationId: generation.id }),
      ),
    ).toEqual({ editUrl: 'https://canva.test/design/D1/edit' });
    expect(deps.officeFiles.documents).toEqual([
      { title: 'Fractions', blocks: parseMarkdown(generation.content) },
    ]);
    expect(deps.canvaDesigns.imports[0]).toMatchObject({ title: 'Fractions', mimeType: docx });
  });

  it("never sends another school's material", async () => {
    const { deps, generation } = await teacher(makeWorld());
    expect(
      await new SendGenerationToCanva(deps).execute({
        actor: outsider,
        generationId: generation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(deps.canvaDesigns.imports).toEqual([]);
  });
});

describe('Downloading a presentation as PowerPoint', () => {
  it('gives the teacher their own presentation as a .pptx file named after it', async () => {
    const { actor, deps, presentation } = await teacher(makeWorld(), { connect: false });
    expect(
      valueOf(
        await new DownloadPresentationFile(deps).execute({
          actor,
          presentationId: presentation.id,
        }),
      ),
    ).toEqual({ fileName: 'Volcanoes.pptx', bytes: new TextEncoder().encode('pptx:Volcanoes') });
    expect(
      await new DownloadPresentationFile(deps).execute({
        actor: outsider,
        presentationId: presentation.id,
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});
