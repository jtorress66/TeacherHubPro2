'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ClassId, GameId, LiveSessionId } from '@thp/domain';
import type { GameRound, LiveJoin, LiveLobby, RoundResult } from '@thp/application';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors, messageFor } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface LiveFormState {
  readonly errors?: Readonly<Record<string, string>>;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const livePath = (locale: Locale) => `/${locale}/app/live`;

/** Opens a live or self-paced session and goes to its host screen. */
export async function startLiveSessionAction(
  _state: LiveFormState,
  data: FormData,
): Promise<LiveFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const mode = text(data, 'mode');
  const seconds = text(data, 'questionSeconds');
  const session = await getAppContainer().startLiveSession.execute({
    actor: user,
    gameId: text(data, 'gameId') as GameId,
    classId: text(data, 'classId') as ClassId,
    kind: text(data, 'kind'),
    ...(mode === '' ? {} : { mode }),
    ...(seconds === '' ? {} : { questionSeconds: Number(seconds) }),
  });
  if (!session.ok) return { errors: formErrors(session.error, locale) };
  redirect(`${livePath(locale)}/${session.value.id}`);
}

export async function deleteLiveSessionAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().deleteLiveSession.execute({
    actor: user,
    sessionId: text(data, 'sessionId') as LiveSessionId,
  });
  redirect(livePath(locale));
}

// Students: no account. A PIN finds the session; tapping a name joins it; the ticket that comes
// back is the only key for the rest.

export type LobbyReply = { readonly ok: true; readonly lobby: LiveLobby } | { readonly ok: false };
export type JoinReply =
  { readonly ok: true; readonly join: LiveJoin } | { readonly ok: false; readonly message: string };

const pin = z
  .string()
  .trim()
  .regex(/^\d{6}$/u);

export async function findLiveByPinAction(input: { readonly pin: string }): Promise<LobbyReply> {
  const parsed = pin.safeParse(input.pin);
  if (!parsed.success) return { ok: false };
  const lobby = await getAppContainer().findLiveSessionByPin.execute({ pin: parsed.data });
  return lobby.ok ? { ok: true, lobby: lobby.value } : { ok: false };
}

const joinInput = z.object({
  pin,
  studentId: z.string().min(1).max(200),
  reconnectToken: z.string().max(200).optional(),
});

export async function joinLiveAction(
  locale: Locale,
  input: z.input<typeof joinInput>,
): Promise<JoinReply> {
  const parsed = joinInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: messageFor({ code: 'not_found' }, locale) };
  const { reconnectToken, ...rest } = parsed.data;
  const join = await getAppContainer().joinLiveSession.execute({
    ...rest,
    ...(reconnectToken === undefined ? {} : { reconnectToken }),
  });
  return join.ok
    ? { ok: true, join: join.value }
    : { ok: false, message: messageFor(join.error, locale) };
}

export type SelfPacedRoundReply =
  { readonly ok: true; readonly round: GameRound } | { readonly ok: false };
export type SelfPacedFinishReply =
  { readonly ok: true; readonly result: RoundResult } | { readonly ok: false };

const roundInput = z.object({ gameId: z.string().min(1), mode: z.string().optional() });
const finishInput = z.object({
  gameId: z.string().min(1),
  mode: z.string().min(1),
  seed: z.number(),
  answers: z.unknown(),
  durationMs: z.number(),
});

async function actorOf(ticket: string) {
  const actor = await getAppContainer().verifyLiveTicket.execute({ ticket });
  return actor.ok ? actor.value : null;
}

/** A round of a self-paced session's game for the player holding the ticket. */
export async function startSelfPacedRoundAction(
  ticket: string,
  input: z.input<typeof roundInput>,
): Promise<SelfPacedRoundReply> {
  const parsed = roundInput.safeParse(input);
  const actor = parsed.success ? await actorOf(ticket) : null;
  if (!parsed.success || actor === null) return { ok: false };
  const { mode } = parsed.data;
  const round = await getAppContainer().startSelfPacedRound.execute({
    actor,
    ...(mode === undefined ? {} : { mode }),
  });
  return round.ok ? { ok: true, round: round.value } : { ok: false };
}

export async function finishSelfPacedRoundAction(
  ticket: string,
  input: z.input<typeof finishInput>,
): Promise<SelfPacedFinishReply> {
  const parsed = finishInput.safeParse(input);
  const actor = parsed.success ? await actorOf(ticket) : null;
  if (!parsed.success || actor === null) return { ok: false };
  const result = await getAppContainer().finishSelfPacedRound.execute({ actor, ...parsed.data });
  return result.ok ? { ok: true, result: result.value } : { ok: false };
}
