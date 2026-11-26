import {
  invalid,
  ok,
  pictureKeyFor,
  picturesOf,
  validatePictureFile,
  withPictureIds,
  type Game,
  type GameContent,
  type GameId,
  type LiveSession,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type {
  Clock,
  FileStore,
  GameRepository,
  IdGenerator,
  LivePlayerRepository,
  LiveSessionRepository,
  PictureCleaner,
  StoredFile,
  TicketSigner,
} from '@thp/ports';
import type { StudentKey } from '../assignments/student-portal.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { VerifyLiveTicket } from '../live/live-join.ts';
import { findOwnGame, type GameRef } from './game-access.ts';
import { linkGame, type StudentGameDeps } from './play.ts';

export interface UploadedPicture {
  readonly id: string;
}

/**
 * Stores a picture for the teacher's game items: PNG, JPEG, WebP or GIF up to 2 MB, read from
 * its bytes, with its location and other camera details removed before it is kept. It belongs
 * to the teacher's school; a game shows it once an item names it.
 */
export class UploadGamePicture {
  constructor(
    private readonly deps: {
      readonly files: FileStore;
      readonly pictureCleaner: PictureCleaner;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly bytes: Uint8Array;
  }): Promise<Result<UploadedPicture, UseCaseError>> {
    const type = validatePictureFile(input.bytes);
    if (!type.ok) return type;
    const cleaned = await this.deps.pictureCleaner.clean(input.bytes, type.value);
    if (!cleaned.ok) return invalid('picture', 'invalid_format');
    const id = this.deps.ids.next();
    const stored = await this.deps.files.put(pictureKeyFor(input.actor.schoolId, id), {
      bytes: cleaned.value,
      contentType: type.value,
    });
    return stored.ok ? ok({ id }) : fail('storage_unavailable');
  }
}

/** The picture's file, when the game really has that picture; anything else is not found. */
async function pictureFile(
  files: FileStore,
  game: Game,
  pictureId: string,
): Promise<Result<StoredFile, UseCaseError>> {
  if (!picturesOf(game.content).some((picture) => picture.id === pictureId)) {
    return fail('not_found');
  }
  const file = await files.get(pictureKeyFor(game.schoolId, pictureId));
  return file.ok ? ok(file.value) : fail('not_found');
}

/** A picture in a game the teacher made, or that their school's admin manages. */
export class GetGamePicture {
  constructor(
    private readonly deps: { readonly games: GameRepository; readonly files: FileStore },
  ) {}

  async execute(
    input: GameRef & { readonly pictureId: string },
  ): Promise<Result<StoredFile, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    return game.ok ? pictureFile(this.deps.files, game.value, input.pictureId) : game;
  }
}

/** A picture in a game shared with the student's class, opened with their link. */
export class GetStudentGamePicture {
  constructor(private readonly deps: StudentGameDeps & { readonly files: FileStore }) {}

  async execute(
    input: StudentKey & { readonly gameId: GameId; readonly pictureId: string },
  ): Promise<Result<StoredFile, UseCaseError>> {
    const found = await linkGame(this.deps, input, input.gameId);
    return found.ok ? pictureFile(this.deps.files, found.value.game, input.pictureId) : found;
  }
}

/** A picture in the game a live session is playing, for its host and its players' tickets. */
export class GetLiveGamePicture {
  private readonly verify: VerifyLiveTicket;

  constructor(
    private readonly deps: {
      readonly ticketSigner: TicketSigner;
      readonly livePlayers: LivePlayerRepository;
      readonly liveSessions: LiveSessionRepository;
      readonly games: GameRepository;
      readonly files: FileStore;
      readonly clock: Clock;
    },
  ) {
    this.verify = new VerifyLiveTicket(deps);
  }

  async execute(input: {
    readonly ticket: string;
    readonly pictureId: string;
  }): Promise<Result<StoredFile, UseCaseError>> {
    const actor = await this.verify.execute({ ticket: input.ticket });
    if (!actor.ok) return actor;
    const { schoolId, sessionId } = actor.value;
    const session: LiveSession | null = await this.deps.liveSessions.findById(schoolId, sessionId);
    if (session === null) return fail('not_found');
    const game = await this.deps.games.findById(schoolId, session.gameId);
    return game === null ? fail('not_found') : pictureFile(this.deps.files, game, input.pictureId);
  }
}

export interface PictureFiles {
  readonly files: FileStore;
  readonly ids: IdGenerator;
}

/**
 * The content with each picture `copies` says to copy given its own new file, so the copy and
 * the original never share one (deleting either leaves the other's pictures in place).
 */
export async function copyPictures(
  deps: PictureFiles,
  schoolId: SchoolId,
  content: GameContent,
  copies: (pictureId: string) => boolean = () => true,
): Promise<Result<GameContent, UseCaseError>> {
  const renamed = new Map<string, string>();
  for (const { id } of picturesOf(content)) {
    if (!copies(id) || renamed.has(id)) continue;
    const file = await deps.files.get(pictureKeyFor(schoolId, id));
    if (!file.ok) continue;
    const copy = deps.ids.next();
    const stored = await deps.files.put(pictureKeyFor(schoolId, copy), file.value);
    if (!stored.ok) return fail('storage_unavailable');
    renamed.set(id, copy);
  }
  return ok(withPictureIds(content, (id) => renamed.get(id) ?? id));
}

/** Deletes the files of pictures a game no longer has. */
export async function deletePictures(
  files: FileStore,
  schoolId: SchoolId,
  pictureIds: readonly string[],
): Promise<void> {
  for (const id of pictureIds) await files.delete(pictureKeyFor(schoolId, id));
}
