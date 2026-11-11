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
import { fail, type ApplicationErrorCode, type UseCaseError } from '../errors.ts';

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
 * A fresh access token, for OneDrive or, with `teams`, for Teams too; refreshes ask only for
 * what the call needs and the grant covers. When Microsoft issues a new refresh token, the newest
 * is kept (encrypted). Access Microsoft no longer accepts is forgotten, so Settings offers to
 * connect again; Teams that is no longer granted is forgotten alone, so Settings offers to allow
 * it again.
 */
export async function microsoftAccess(
  deps: MicrosoftConnectionDeps,
  actor: User,
  { teams = false }: { readonly teams?: boolean } = {},
): Promise<Result<string, UseCaseError>> {
  const connection = await deps.microsoftConnections.find(actor.schoolId, actor.id);
  if (connection === null) return fail('microsoft_not_connected');
  if (teams && !connection.teams) return fail('teams_not_allowed');
  const refresh = await deps.cipher.decrypt(connection.encryptedRefreshToken);
  const granted = refresh.ok ? await deps.microsoftAuth.refresh(refresh.value, { teams }) : null;
  if (granted !== null && !granted.ok) {
    if (granted.error.code === 'insufficient_scope' && teams) {
      await deps.microsoftConnections.save({ ...connection, teams: false });
      return fail('teams_not_allowed');
    }
    if (granted.error.code !== 'unauthorized') return microsoftFailed(granted.error);
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

  /** With `teams`, also asks for Teams (school accounts; an administrator may need to approve). */
  execute(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
    readonly teams?: boolean;
  }): string {
    return this.deps.microsoftAuth.authorizationUrl({ ...input, teams: input.teams ?? false });
  }
}

/**
 * Keeps the granted access, encrypted, and whether it includes Teams. Asked for Teams, a grant
 * without it (a personal account) still keeps OneDrive, and says Teams needs a school account.
 */
export class FinishMicrosoftConnect {
  constructor(private readonly deps: MicrosoftConnectionDeps & { readonly clock: Clock }) {}

  async execute(input: {
    readonly actor: User;
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
    readonly teams?: boolean;
  }): Promise<Result<{ readonly teams: boolean }, UseCaseError>> {
    const asked = input.teams ?? false;
    const granted = await this.deps.microsoftAuth.exchangeCode({ ...input, teams: asked });
    if (!granted.ok) return fail('microsoft_failed');
    await this.deps.microsoftConnections.save(
      connectMicrosoft({
        schoolId: input.actor.schoolId,
        teacherId: input.actor.id,
        encryptedRefreshToken: await this.deps.cipher.encrypt(granted.value.refreshToken),
        teams: granted.value.teams,
        connectedAt: this.deps.clock.now(),
      }),
    );
    if (asked && !granted.value.teams) return fail('teams_school_account');
    return ok({ teams: granted.value.teams });
  }
}

/** The teacher's fix when Microsoft sends back a refusal instead of a code. */
export class ExplainMicrosoftRefusal {
  constructor(private readonly deps: { readonly microsoftAuth: MicrosoftAuthorization }) {}

  execute(input: {
    readonly error: string;
    readonly description: string | null;
    /** Whether Teams was asked for. */
    readonly teams: boolean;
  }): { readonly code: ApplicationErrorCode } {
    const { code } = this.deps.microsoftAuth.refusal({
      error: input.error,
      description: input.description,
    });
    if (code === 'admin_approval_required') {
      return { code: input.teams ? 'teams_admin_approval' : 'microsoft_admin_approval' };
    }
    if (!input.teams) return { code: 'microsoft_failed' };
    if (code === 'school_account_required') return { code: 'teams_school_account' };
    return { code: code === 'declined' ? 'teams_declined' : 'microsoft_failed' };
  }
}

/** Whether the teacher's Microsoft connection includes Teams. */
export class TeamsAllowed {
  constructor(
    private readonly deps: { readonly microsoftConnections: MicrosoftConnectionRepository },
  ) {}

  async execute(input: { readonly actor: User }): Promise<boolean> {
    const connection = await this.deps.microsoftConnections.find(
      input.actor.schoolId,
      input.actor.id,
    );
    return connection?.teams === true;
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
