'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { GameId } from '@thp/domain';
import type { GameRound, RoundResult } from '@thp/application';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { submittedValues, type SubmittedValues } from '../../server/form-values.ts';
import { getAppContainer } from '../../container.ts';
import { rejectedForm } from '../../server/error-messages.ts';
import {
  gameFormErrors,
  parseConfirmScores,
  parseGameDraftForm,
  parseGameForm,
  parseGradingForm,
} from '../../server/game-forms.ts';
import { requireUser } from './auth.ts';
import { passFor } from './lti-pass.ts';

export interface GameFormState {
  /** What the teacher sent, when it was refused, so the form shows it again. */
  readonly values?: SubmittedValues;
  readonly errors?: Readonly<Record<string, string>>;
  readonly saved?: boolean;
  readonly message?: string;
  /** Changes after each success so the form can clear itself. */
  readonly version?: number;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const gameIdOf = (data: FormData): GameId => {
  const value = data.get('gameId');
  return (typeof value === 'string' ? value : '') as GameId;
};

const gamesPath = (locale: Locale) => `/${locale}/app/games`;

const done = (state: GameFormState, message?: string): GameFormState => ({
  saved: true,
  version: (state.version ?? 0) + 1,
  ...(message === undefined ? {} : { message }),
});

export async function createGameAction(
  _state: GameFormState,
  data: FormData,
): Promise<GameFormState> {
  const { locale, input } = parseGameForm(data);
  const { user } = await requireUser(locale);
  const game = await getAppContainer().createGame.execute({ actor: user, ...input });
  if (!game.ok)
    return { errors: gameFormErrors(game.error, locale), values: submittedValues(data) };
  redirect(`${gamesPath(locale)}/${game.value.id}`);
}

export async function updateGameAction(
  state: GameFormState,
  data: FormData,
): Promise<GameFormState> {
  const { locale, input } = parseGameForm(data);
  const { user } = await requireUser(locale);
  const gameId = gameIdOf(data);
  const game = await getAppContainer().updateGame.execute({ actor: user, gameId, changes: input });
  if (!game.ok)
    return { errors: gameFormErrors(game.error, locale), values: submittedValues(data) };
  revalidatePath(`${gamesPath(locale)}/${gameId}`);
  return done(state, createTranslator(locale)('games.saved'));
}

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

/** Saves a copy of the game, then opens it. */
export async function duplicateGameAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const title = createTranslator(locale)('games.copyTitle', { title: field(data, 'title') });
  const copy = await getAppContainer().duplicateGame.execute({
    actor: user,
    gameId: gameIdOf(data),
    title,
  });
  if (!copy.ok) redirect(gamesPath(locale));
  redirect(`${gamesPath(locale)}/${copy.value.id}?copied=1`);
}

/** Why items could not be added, as the page names it. */
function addProblem(error: { readonly code: string; readonly field?: string }): string {
  if (error.field === 'source') return error.code === 'duplicate' ? 'nothingNew' : 'wrongKind';
  return 'failed';
}

/** Adds another game's items to this one, then says how many. */
export async function addItemsFromGameAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const gameId = gameIdOf(data);
  const result = await getAppContainer().addItemsFromGame.execute({
    actor: user,
    gameId,
    sourceId: field(data, 'sourceId') as GameId,
  });
  const page = `${gamesPath(locale)}/${gameId}`;
  revalidatePath(page);
  const query = result.ok
    ? `added=${String(result.value.added)}&skipped=${String(result.value.skipped)}`
    : `addError=${addProblem(result.error)}`;
  redirect(`${page}?${query}#add-items-heading`);
}

export async function deleteGameAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().deleteGame.execute({ actor: user, gameId: gameIdOf(data) });
  redirect(gamesPath(locale));
}

/** Queues the AI's draft and opens its progress page, remembering the chosen mode. */
export async function requestGameDraftAction(
  _state: GameFormState,
  data: FormData,
): Promise<GameFormState> {
  const { locale, mode, input } = parseGameDraftForm(data);
  const { user } = await requireUser(locale);
  const job = await getAppContainer().requestGameDraft.execute({ actor: user, ...input });
  if (!job.ok) return rejectedForm(job.error, locale, data);
  redirect(`${gamesPath(locale)}/jobs/${job.value.id}?mode=${encodeURIComponent(mode)}`);
}

export async function saveGameGradingAction(
  state: GameFormState,
  data: FormData,
): Promise<GameFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const gameId = gameIdOf(data);
  const saved = await getAppContainer().saveGameGrading.execute({
    actor: user,
    gameId,
    ...parseGradingForm(data),
  });
  if (!saved.ok) return rejectedForm(saved.error, locale, data);
  revalidatePath(`${gamesPath(locale)}/${gameId}`);
  return done(state, createTranslator(locale)('games.saved'));
}

export async function confirmGameGradesAction(
  state: GameFormState,
  data: FormData,
): Promise<GameFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const gameId = gameIdOf(data);
  const confirmed = await getAppContainer().confirmGameGrades.execute({
    actor: user,
    gameId,
    scores: parseConfirmScores(data),
  });
  if (!confirmed.ok) return rejectedForm(confirmed.error, locale, data);
  revalidatePath(`${gamesPath(locale)}/${gameId}`);
  return done(state, createTranslator(locale)('games.gradesConfirmed'));
}

// Rounds, called by the game player. What the browser sends is checked here, then scored by the
// game mode's own rules on the server.

export type RoundReply = { readonly ok: true; readonly round: GameRound } | { readonly ok: false };
export type FinishReply =
  { readonly ok: true; readonly result: RoundResult } | { readonly ok: false };

const startInput = z.object({ gameId: z.string().min(1), mode: z.string().optional() });
const finishInput = z.object({
  gameId: z.string().min(1),
  mode: z.string().min(1),
  seed: z.number(),
  answers: z.unknown(),
  durationMs: z.number(),
});

export type StartRoundInput = z.input<typeof startInput>;
export type FinishRoundInput = z.input<typeof finishInput>;

const roundReply = (round: { ok: true; value: GameRound } | { ok: false }): RoundReply =>
  round.ok ? { ok: true, round: round.value } : { ok: false };

const finishReply = (result: { ok: true; value: RoundResult } | { ok: false }): FinishReply =>
  result.ok ? { ok: true, result: result.value } : { ok: false };

/** A round for the student behind the link (bound to the token by the page). */
export async function startStudentRoundAction(
  token: string,
  input: StartRoundInput,
): Promise<RoundReply> {
  const parsed = startInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { gameId, mode } = parsed.data;
  return roundReply(
    await getAppContainer().startGameRound.execute({
      token,
      gameId: gameId as GameId,
      ...(mode === undefined ? {} : { mode }),
    }),
  );
}

export async function finishStudentRoundAction(
  token: string,
  input: FinishRoundInput,
): Promise<FinishReply> {
  const parsed = finishInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  return finishReply(
    await getAppContainer().finishGameRound.execute({
      token,
      ...parsed.data,
      gameId: parsed.data.gameId as GameId,
    }),
  );
}

/** A round the teacher plays to try their game; never saved. */
export async function startPreviewRoundAction(
  locale: Locale,
  input: StartRoundInput,
): Promise<RoundReply> {
  const parsed = startInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { user } = await requireUser(locale);
  const { gameId, mode } = parsed.data;
  return roundReply(
    await getAppContainer().startPreviewRound.execute({
      actor: user,
      gameId: gameId as GameId,
      ...(mode === undefined ? {} : { mode }),
    }),
  );
}

export async function finishPreviewRoundAction(
  locale: Locale,
  input: FinishRoundInput,
): Promise<FinishReply> {
  const parsed = finishInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { user } = await requireUser(locale);
  return finishReply(
    await getAppContainer().finishPreviewRound.execute({
      actor: user,
      ...parsed.data,
      gameId: parsed.data.gameId as GameId,
    }),
  );
}

/** A round for a student who opened the game from their course system (their pass's cookie). */
export async function startPassRoundAction(input: StartRoundInput): Promise<RoundReply> {
  const parsed = startInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { gameId, mode } = parsed.data;
  const pass = await passFor({ kind: 'game', id: gameId as GameId });
  return roundReply(
    await getAppContainer().startGameRound.execute({
      pass,
      gameId: gameId as GameId,
      ...(mode === undefined ? {} : { mode }),
    }),
  );
}

export async function finishPassRoundAction(input: FinishRoundInput): Promise<FinishReply> {
  const parsed = finishInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const gameId = parsed.data.gameId as GameId;
  const pass = await passFor({ kind: 'game', id: gameId });
  return finishReply(
    await getAppContainer().finishGameRound.execute({ pass, ...parsed.data, gameId }),
  );
}
