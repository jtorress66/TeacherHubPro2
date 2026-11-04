import type { GameModeId } from '../games/mode-registry.ts';
import type { ClassId, GameId, LiveSessionId, SchoolId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import {
  guardTransition,
  type InvalidTransition,
  type TransitionTable,
} from '../shared/state-machine.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

/** Live: the whole class answers each question together. Self-paced: each student plays alone. */
export const liveKinds = ['live', 'self_paced'] as const;
export type LiveKind = (typeof liveKinds)[number];

export type LiveStatus = 'lobby' | 'question' | 'reveal' | 'open' | 'ended';
type LiveAction = 'start' | 'reveal' | 'next' | 'end';

const transitions: TransitionTable<LiveStatus, LiveAction> = {
  start: ['lobby'],
  reveal: ['question'],
  next: ['reveal'],
  end: ['lobby', 'question', 'reveal', 'open'],
};

export type LiveTransitionError = InvalidTransition<LiveStatus, LiveAction>;

/** A Play to Learn session of one game for one class, joined with a PIN. */
export interface LiveSession {
  readonly id: LiveSessionId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly gameId: GameId;
  readonly classId: ClassId;
  readonly kind: LiveKind;
  readonly mode: GameModeId;
  readonly pin: string;
  /** Rebuilds the same questions, in the same order, for everyone in the session. */
  readonly seed: number;
  readonly questionCount: number;
  readonly questionSeconds: number;
  readonly status: LiveStatus;
  /** The question on screen; -1 before the first. */
  readonly current: number;
  readonly questionStartedAt: Date | null;
  readonly createdAt: Date;
  readonly endedAt: Date | null;
}

export type LiveSessionInput = Omit<
  LiveSession,
  'status' | 'current' | 'questionStartedAt' | 'endedAt'
>;

export const questionSecondsRange = { min: 5, max: 120, default: 20 } as const;
/** Open sessions close by themselves after this long. */
export const liveSessionLifetimeMs = 3 * 60 * 60 * 1000;

export function createLiveSession(input: LiveSessionInput): Result<LiveSession, ValidationError> {
  if (!/^\d{6}$/u.test(input.pin)) return invalid('pin', 'invalid_format');
  if (input.questionCount < 1) return invalid('questionCount', 'too_short');
  const seconds = input.questionSeconds;
  if (
    !Number.isInteger(seconds) ||
    seconds < questionSecondsRange.min ||
    seconds > questionSecondsRange.max
  ) {
    return invalid('questionSeconds', 'out_of_range');
  }
  return ok({
    ...input,
    status: input.kind === 'live' ? 'lobby' : 'open',
    current: -1,
    questionStartedAt: null,
    endedAt: null,
  });
}

export function startGame(
  session: LiveSession,
  now: Date,
): Result<LiveSession, LiveTransitionError> {
  const allowed = guardTransition(transitions, session.status, 'start');
  if (!allowed.ok) return allowed;
  return ok({ ...session, status: 'question', current: 0, questionStartedAt: now });
}

export function revealAnswer(session: LiveSession): Result<LiveSession, LiveTransitionError> {
  const allowed = guardTransition(transitions, session.status, 'reveal');
  return allowed.ok ? ok({ ...session, status: 'reveal' }) : allowed;
}

/** The next question, or the end after the last one. */
export function nextQuestion(
  session: LiveSession,
  now: Date,
): Result<LiveSession, LiveTransitionError> {
  const allowed = guardTransition(transitions, session.status, 'next');
  if (!allowed.ok) return allowed;
  if (session.current + 1 >= session.questionCount) {
    return ok({ ...session, status: 'ended', endedAt: now });
  }
  return ok({
    ...session,
    status: 'question',
    current: session.current + 1,
    questionStartedAt: now,
  });
}

export function endSession(
  session: LiveSession,
  now: Date,
): Result<LiveSession, LiveTransitionError> {
  const allowed = guardTransition(transitions, session.status, 'end');
  return allowed.ok ? ok({ ...session, status: 'ended', endedAt: now }) : allowed;
}

export const questionLimitMs = (session: LiveSession): number => session.questionSeconds * 1000;

/** Time left to answer the question on screen. */
export function timeLeftMs(session: LiveSession, now: Date): number {
  if (session.status !== 'question' || session.questionStartedAt === null) return 0;
  const elapsed = now.getTime() - session.questionStartedAt.getTime();
  return Math.max(0, questionLimitMs(session) - elapsed);
}

export const isOpen = (session: LiveSession): boolean => session.status !== 'ended';

export const isStaleLiveSession = (session: LiveSession, now: Date): boolean =>
  isOpen(session) && now.getTime() - session.createdAt.getTime() >= liveSessionLifetimeMs;

/** Any whole number as a 6-digit PIN (100000–999999). */
export const pinFromSeed = (seed: number): string => String(100_000 + (seed % 900_000));
