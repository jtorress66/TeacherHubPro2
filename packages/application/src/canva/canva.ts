import {
  canvaTitle,
  connectCanva,
  ok,
  parseMarkdown,
  toGoogleSlides,
  type GenerationId,
  type PresentationId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  AiGenerationRepository,
  CanvaAuthorization,
  CanvaConnectionRepository,
  CanvaDesigns,
  CanvaError,
  CanvaFile,
  Clock,
  DocumentFileWriter,
  PresentationFileWriter,
  PresentationRepository,
  SecretCipher,
} from '@thp/ports';
import { findOwned } from '../assistant/owned.ts';
import { fail, type UseCaseError } from '../errors.ts';

const pptxType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface CanvaConnectionDeps {
  readonly canvaConnections: CanvaConnectionRepository;
  readonly cipher: SecretCipher;
  readonly canvaAuth: CanvaAuthorization;
}

/** Revoked or expired access means connecting again; anything else, trying again. */
const canvaFailed = (error: CanvaError) =>
  fail(error.code === 'unauthorized' ? 'canva_not_connected' : 'canva_failed');

/**
 * A fresh access token. Canva replaces the refresh token at every use, so the new one is kept
 * (encrypted); access Canva no longer accepts is forgotten, so Settings offers to connect again.
 */
async function canvaAccess(
  deps: CanvaConnectionDeps,
  actor: User,
): Promise<Result<string, UseCaseError>> {
  const connection = await deps.canvaConnections.find(actor.schoolId, actor.id);
  if (connection === null) return fail('canva_not_connected');
  const refresh = await deps.cipher.decrypt(connection.encryptedRefreshToken);
  const granted = refresh.ok ? await deps.canvaAuth.refresh(refresh.value) : null;
  if (granted !== null && !granted.ok && granted.error.code !== 'unauthorized') {
    return canvaFailed(granted.error);
  }
  if (!granted?.ok) {
    await deps.canvaConnections.delete(actor.schoolId, actor.id);
    return fail('canva_not_connected');
  }
  await deps.canvaConnections.save({
    ...connection,
    encryptedRefreshToken: await deps.cipher.encrypt(granted.value.refreshToken),
  });
  return ok(granted.value.accessToken);
}

/** Where to send the teacher to grant Canva access. */
export class StartCanvaConnect {
  constructor(private readonly deps: { readonly canvaAuth: CanvaAuthorization }) {}

  execute(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    return this.deps.canvaAuth.authorizationUrl(input);
  }
}

/** Keeps the granted access, encrypted. */
export class FinishCanvaConnect {
  constructor(private readonly deps: CanvaConnectionDeps & { readonly clock: Clock }) {}

  async execute(input: {
    readonly actor: User;
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<Result<true, UseCaseError>> {
    const granted = await this.deps.canvaAuth.exchangeCode(input);
    if (!granted.ok) return fail('canva_failed');
    await this.deps.canvaConnections.save(
      connectCanva({
        schoolId: input.actor.schoolId,
        teacherId: input.actor.id,
        encryptedRefreshToken: await this.deps.cipher.encrypt(granted.value.refreshToken),
        connectedAt: this.deps.clock.now(),
      }),
    );
    return ok(true);
  }
}

/**
 * Cancels the grant at Canva, then forgets it. The local copy is deleted even when Canva cannot
 * be reached, so a disconnect always works on our side.
 */
export class DisconnectCanva {
  constructor(private readonly deps: CanvaConnectionDeps) {}

  async execute(input: { readonly actor: User }): Promise<Result<true, UseCaseError>> {
    const connection = await this.deps.canvaConnections.find(input.actor.schoolId, input.actor.id);
    if (connection === null) return ok(true);
    const refresh = await this.deps.cipher.decrypt(connection.encryptedRefreshToken);
    if (refresh.ok) await this.deps.canvaAuth.revoke(refresh.value);
    await this.deps.canvaConnections.delete(input.actor.schoolId, input.actor.id);
    return ok(true);
  }
}

export class CanvaConnected {
  constructor(private readonly deps: { readonly canvaConnections: CanvaConnectionRepository }) {}

  async execute(input: { readonly actor: User }): Promise<boolean> {
    return (await this.deps.canvaConnections.find(input.actor.schoolId, input.actor.id)) !== null;
  }
}

type ImportDeps = CanvaConnectionDeps & { readonly canvaDesigns: CanvaDesigns };

async function importToCanva(
  deps: ImportDeps,
  actor: User,
  file: () => Promise<CanvaFile>,
): Promise<Result<{ readonly editUrl: string }, UseCaseError>> {
  const token = await canvaAccess(deps, actor);
  if (!token.ok) return token;
  const imported = await deps.canvaDesigns.importFile(token.value, await file());
  return imported.ok ? imported : canvaFailed(imported.error);
}

/** Opens the teacher's own presentation in Canva, as an editable design made from a .pptx. */
export class SendPresentationToCanva {
  constructor(
    private readonly deps: ImportDeps & {
      readonly presentations: PresentationRepository;
      readonly presentationFiles: PresentationFileWriter;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly presentationId: PresentationId;
  }): Promise<Result<{ readonly editUrl: string }, UseCaseError>> {
    const presentation = await findOwned(
      this.deps.presentations,
      input.actor,
      input.presentationId,
    );
    if (!presentation.ok) return presentation;
    return importToCanva(this.deps, input.actor, async () => ({
      title: canvaTitle(presentation.value.name),
      mimeType: pptxType,
      bytes: await this.deps.presentationFiles.pptx(toGoogleSlides(presentation.value)),
    }));
  }
}

/** Opens AI-written material (a worksheet, a quiz) in Canva, as a design made from a .docx. */
export class SendGenerationToCanva {
  constructor(
    private readonly deps: ImportDeps & {
      readonly generations: AiGenerationRepository;
      readonly documentFiles: DocumentFileWriter;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly generationId: GenerationId;
  }): Promise<Result<{ readonly editUrl: string }, UseCaseError>> {
    const generation = await findOwned(this.deps.generations, input.actor, input.generationId);
    if (!generation.ok) return generation;
    const title = canvaTitle(generation.value.topic);
    return importToCanva(this.deps, input.actor, async () => ({
      title,
      mimeType: docxType,
      bytes: await this.deps.documentFiles.docx({
        title,
        blocks: parseMarkdown(generation.value.content),
      }),
    }));
  }
}

/** The teacher's own presentation as a PowerPoint file to download. */
export class DownloadPresentationFile {
  constructor(
    private readonly deps: {
      readonly presentations: PresentationRepository;
      readonly presentationFiles: PresentationFileWriter;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly presentationId: PresentationId;
  }): Promise<Result<{ readonly fileName: string; readonly bytes: Uint8Array }, UseCaseError>> {
    const presentation = await findOwned(
      this.deps.presentations,
      input.actor,
      input.presentationId,
    );
    if (!presentation.ok) return presentation;
    return ok({
      fileName: `${presentation.value.name}.pptx`,
      bytes: await this.deps.presentationFiles.pptx(toGoogleSlides(presentation.value)),
    });
  }
}
