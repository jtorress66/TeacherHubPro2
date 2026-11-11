import {
  connectMicrosoft,
  oneDriveFileName,
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
  Clock,
  DocumentFileWriter,
  MicrosoftAuthorization,
  MicrosoftConnectionRepository,
  MicrosoftError,
  OneDriveFile,
  OneDriveFiles,
  PresentationFileWriter,
  PresentationRepository,
  SecretCipher,
} from '@thp/ports';
import { findOwned } from '../assistant/owned.ts';
import { fail, type UseCaseError } from '../errors.ts';

const pptxType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface MicrosoftConnectionDeps {
  readonly microsoftConnections: MicrosoftConnectionRepository;
  readonly cipher: SecretCipher;
  readonly microsoftAuth: MicrosoftAuthorization;
}

/** Revoked or expired access means connecting again; anything else, trying again. */
const microsoftFailed = (error: MicrosoftError) =>
  fail(error.code === 'unauthorized' ? 'microsoft_not_connected' : 'microsoft_failed');

/**
 * A fresh access token. When Microsoft issues a new refresh token, the newest is kept
 * (encrypted); access Microsoft no longer accepts is forgotten, so Settings offers to connect
 * again.
 */
async function microsoftAccess(
  deps: MicrosoftConnectionDeps,
  actor: User,
): Promise<Result<string, UseCaseError>> {
  const connection = await deps.microsoftConnections.find(actor.schoolId, actor.id);
  if (connection === null) return fail('microsoft_not_connected');
  const refresh = await deps.cipher.decrypt(connection.encryptedRefreshToken);
  const granted = refresh.ok ? await deps.microsoftAuth.refresh(refresh.value) : null;
  if (granted !== null && !granted.ok && granted.error.code !== 'unauthorized') {
    return microsoftFailed(granted.error);
  }
  if (!refresh.ok || !granted?.ok) {
    await deps.microsoftConnections.delete(actor.schoolId, actor.id);
    return fail('microsoft_not_connected');
  }
  if (granted.value.refreshToken !== refresh.value) {
    await deps.microsoftConnections.save({
      ...connection,
      encryptedRefreshToken: await deps.cipher.encrypt(granted.value.refreshToken),
    });
  }
  return ok(granted.value.accessToken);
}

/** Where to send the teacher to grant Microsoft access. */
export class StartMicrosoftConnect {
  constructor(private readonly deps: { readonly microsoftAuth: MicrosoftAuthorization }) {}

  execute(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    return this.deps.microsoftAuth.authorizationUrl(input);
  }
}

/** Keeps the granted access, encrypted. */
export class FinishMicrosoftConnect {
  constructor(private readonly deps: MicrosoftConnectionDeps & { readonly clock: Clock }) {}

  async execute(input: {
    readonly actor: User;
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<Result<true, UseCaseError>> {
    const granted = await this.deps.microsoftAuth.exchangeCode(input);
    if (!granted.ok) return fail('microsoft_failed');
    await this.deps.microsoftConnections.save(
      connectMicrosoft({
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
 * Forgets the access. Microsoft has no way for an app to cancel its own delegated grant, so the
 * teacher can also remove the app from their Microsoft account's app permissions.
 */
export class DisconnectMicrosoft {
  constructor(
    private readonly deps: { readonly microsoftConnections: MicrosoftConnectionRepository },
  ) {}

  async execute(input: { readonly actor: User }): Promise<Result<true, UseCaseError>> {
    await this.deps.microsoftConnections.delete(input.actor.schoolId, input.actor.id);
    return ok(true);
  }
}

export class MicrosoftConnected {
  constructor(
    private readonly deps: { readonly microsoftConnections: MicrosoftConnectionRepository },
  ) {}

  async execute(input: { readonly actor: User }): Promise<boolean> {
    return (
      (await this.deps.microsoftConnections.find(input.actor.schoolId, input.actor.id)) !== null
    );
  }
}

type SaveDeps = MicrosoftConnectionDeps & { readonly oneDriveFiles: OneDriveFiles };

async function saveToOneDrive(
  deps: SaveDeps,
  actor: User,
  file: () => Promise<OneDriveFile>,
): Promise<Result<{ readonly webUrl: string }, UseCaseError>> {
  const token = await microsoftAccess(deps, actor);
  if (!token.ok) return token;
  const saved = await deps.oneDriveFiles.upload(token.value, await file());
  return saved.ok ? saved : microsoftFailed(saved.error);
}

/** Saves the teacher's own presentation in their OneDrive, as a PowerPoint file. */
export class SavePresentationToOneDrive {
  constructor(
    private readonly deps: SaveDeps & {
      readonly presentations: PresentationRepository;
      readonly presentationFiles: PresentationFileWriter;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly presentationId: PresentationId;
  }): Promise<Result<{ readonly webUrl: string }, UseCaseError>> {
    const presentation = await findOwned(
      this.deps.presentations,
      input.actor,
      input.presentationId,
    );
    if (!presentation.ok) return presentation;
    return saveToOneDrive(this.deps, input.actor, async () => ({
      name: oneDriveFileName(presentation.value.name, 'pptx'),
      mimeType: pptxType,
      bytes: await this.deps.presentationFiles.pptx(toGoogleSlides(presentation.value)),
    }));
  }
}

/** Saves AI-written material (a worksheet, a quiz) in the teacher's OneDrive, as a Word file. */
export class SaveGenerationToOneDrive {
  constructor(
    private readonly deps: SaveDeps & {
      readonly generations: AiGenerationRepository;
      readonly documentFiles: DocumentFileWriter;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly generationId: GenerationId;
  }): Promise<Result<{ readonly webUrl: string }, UseCaseError>> {
    const generation = await findOwned(this.deps.generations, input.actor, input.generationId);
    if (!generation.ok) return generation;
    const { topic, content } = generation.value;
    return saveToOneDrive(this.deps, input.actor, async () => ({
      name: oneDriveFileName(topic, 'docx'),
      mimeType: docxType,
      bytes: await this.deps.documentFiles.docx({
        title: topic.trim(),
        blocks: parseMarkdown(content),
      }),
    }));
  }
}
