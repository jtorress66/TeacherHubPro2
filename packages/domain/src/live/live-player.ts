import type { LivePlayerId, LiveSessionId, SchoolId, StudentId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { questionLimitMs, type LiveSession } from './live-session.ts';

/** A roster student who joined a session by tapping their name. */
export interface LivePlayer {
  readonly id: LivePlayerId;
  readonly schoolId: SchoolId;
  readonly sessionId: LiveSessionId;
  readonly studentId: StudentId;
  /** Shown on the big screen: first names only. */
  readonly firstName: string;
  /** Lets the same device reconnect; only its hash is stored. */
  readonly tokenHash: string;
  readonly joinedAt: Date;
  readonly removedAt: Date | null;
}

export type LivePlayerInput = Omit<LivePlayer, 'removedAt'>;

/** One answer to one question; the server times and scores it. */
export interface LiveAnswer {
  readonly schoolId: SchoolId;
  readonly sessionId: LiveSessionId;
  readonly playerId: LivePlayerId;
  readonly question: number;
  /** The question's text, so insights can match it across sessions (each shuffles its order). */
  readonly prompt: string;
  readonly choice: number;
  readonly correct: boolean;
  readonly ms: number;
  readonly points: number;
}

export function joinPlayer(input: LivePlayerInput): Result<LivePlayer, ValidationError> {
  const firstName = requiredText('firstName', input.firstName);
  return firstName.ok ? ok({ ...input, firstName: firstName.value, removedAt: null }) : firstName;
}

export const removePlayer = (player: LivePlayer, now: Date): LivePlayer => ({
  ...player,
  removedAt: player.removedAt ?? now,
});

export const maxLivePoints = 1000;
const streakBonus = 100;
const maxStreakBonus = 500;

/** Up to 1000 for a correct answer (half of it for speed), plus 100 per answer in a row before. */
export function livePoints(answer: {
  readonly correct: boolean;
  readonly ms: number;
  readonly limitMs: number;
  readonly streakBefore: number;
}): number {
  if (!answer.correct) return 0;
  const share = Math.min(answer.ms, answer.limitMs) / answer.limitMs;
  const speed = Math.round(maxLivePoints * (1 - share / 2));
  return speed + Math.min(answer.streakBefore * streakBonus, maxStreakBonus);
}

/** Correct answers in a row just before `question`; a wrong or missed one ends it. */
function streakBefore(previous: readonly LiveAnswer[], question: number): number {
  const byQuestion = new Map(previous.map((a) => [a.question, a]));
  let streak = 0;
  for (let q = question - 1; q >= 0 && byQuestion.get(q)?.correct === true; q -= 1) streak += 1;
  return streak;
}

export interface AnswerInput {
  readonly session: LiveSession;
  readonly player: LivePlayer;
  /** The player's earlier answers in this session. */
  readonly previous: readonly LiveAnswer[];
  readonly question: number;
  readonly prompt: string;
  readonly choice: number;
  readonly correct: boolean;
  readonly now: Date;
}

/** One answer to the question on screen, in time, once. */
export function answerQuestion(input: AnswerInput): Result<LiveAnswer, ValidationError> {
  const { session, player, question } = input;
  const onScreen = session.status === 'question' && session.current === question;
  if (!onScreen || player.removedAt !== null) return invalid('answer', 'not_allowed');
  if (input.previous.some((a) => a.question === question)) return invalid('answer', 'duplicate');
  const started = session.questionStartedAt?.getTime() ?? input.now.getTime();
  const ms = Math.max(0, input.now.getTime() - started);
  const limitMs = questionLimitMs(session);
  if (ms > limitMs) return invalid('answer', 'out_of_range');
  return ok({
    schoolId: player.schoolId,
    sessionId: session.id,
    playerId: player.id,
    question,
    prompt: input.prompt,
    choice: input.choice,
    correct: input.correct,
    ms,
    points: livePoints({
      correct: input.correct,
      ms,
      limitMs,
      streakBefore: streakBefore(input.previous, question),
    }),
  });
}

export interface LiveStanding {
  readonly score: number;
  readonly correct: number;
  readonly answered: number;
  /** Correct answers in a row up to the latest one. */
  readonly streak: number;
  readonly bestStreak: number;
  readonly totalMs: number;
}

export function standingOf(playerId: LivePlayerId, answers: readonly LiveAnswer[]): LiveStanding {
  const own = answers
    .filter((a) => a.playerId === playerId)
    .sort((a, b) => a.question - b.question);
  let streak = 0;
  let bestStreak = 0;
  let last = -1;
  for (const a of own) {
    streak = a.correct && a.question === last + 1 ? streak + 1 : a.correct ? 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    last = a.question;
  }
  return {
    score: own.reduce((sum, a) => sum + a.points, 0),
    correct: own.filter((a) => a.correct).length,
    answered: own.length,
    streak,
    bestStreak,
    totalMs: own.reduce((sum, a) => sum + a.ms, 0),
  };
}

export interface LiveLeaderboardRow extends LiveStanding {
  readonly rank: number;
  readonly playerId: LivePlayerId;
  readonly firstName: string;
}

/** Players still in the game, by points, then by less time, then by who joined first. */
export function liveLeaderboard(
  players: readonly LivePlayer[],
  answers: readonly LiveAnswer[],
): LiveLeaderboardRow[] {
  return players
    .filter((p) => p.removedAt === null)
    .map((p) => ({ player: p, standing: standingOf(p.id, answers) }))
    .sort(
      (a, b) =>
        b.standing.score - a.standing.score ||
        a.standing.totalMs - b.standing.totalMs ||
        a.player.joinedAt.getTime() - b.player.joinedAt.getTime(),
    )
    .map(({ player, standing }, index) => ({
      ...standing,
      rank: index + 1,
      playerId: player.id,
      firstName: player.firstName,
    }));
}

export interface QuestionStats {
  readonly answered: number;
  readonly correct: number;
  readonly percentCorrect: number | null;
  /** How many tapped each option. */
  readonly distribution: readonly number[];
}

export function questionStats(
  answers: readonly LiveAnswer[],
  question: number,
  optionCount: number,
): QuestionStats {
  const forQuestion = answers.filter((a) => a.question === question);
  const correct = forQuestion.filter((a) => a.correct).length;
  const distribution = Array.from(
    { length: optionCount },
    (_, option) => forQuestion.filter((a) => a.choice === option).length,
  );
  return {
    answered: forQuestion.length,
    correct,
    percentCorrect:
      forQuestion.length === 0 ? null : Math.round((correct / forQuestion.length) * 100),
    distribution,
  };
}

/**
 * How students appear when picking their name: first names, with a last initial only where two
 * first names match. Sorted by name.
 */
export function rosterNames(
  students: readonly {
    readonly id: StudentId;
    readonly firstName: string;
    readonly lastName: string;
  }[],
): { readonly studentId: StudentId; readonly name: string }[] {
  const key = (name: string) => name.trim().toLocaleLowerCase();
  const counts = new Map<string, number>();
  for (const s of students) counts.set(key(s.firstName), (counts.get(key(s.firstName)) ?? 0) + 1);
  return students
    .map((s) => ({
      studentId: s.id,
      name:
        (counts.get(key(s.firstName)) ?? 0) > 1
          ? `${s.firstName.trim()} ${s.lastName.trim().charAt(0)}.`
          : s.firstName.trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
