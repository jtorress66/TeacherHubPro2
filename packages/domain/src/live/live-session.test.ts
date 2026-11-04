import { describe, expect, it } from 'vitest';
import type { ClassId, GameId, LiveSessionId, SchoolId, UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import {
  createLiveSession,
  endSession,
  isStaleLiveSession,
  nextQuestion,
  pinFromSeed,
  revealAnswer,
  startGame,
  timeLeftMs,
  type LiveSessionInput,
} from './live-session.ts';

const at = (seconds: number) => new Date(Date.UTC(2026, 10, 4, 10, 0, seconds));

const input: LiveSessionInput = {
  id: 'live-1' as LiveSessionId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'teacher-1' as UserId,
  gameId: 'game-1' as GameId,
  classId: 'class-1' as ClassId,
  kind: 'live',
  mode: 'quiz',
  pin: '482913',
  seed: 7,
  questionCount: 3,
  questionSeconds: 20,
  createdAt: at(0),
};

const lobby = () => valueOf(createLiveSession(input));

describe('createLiveSession', () => {
  it('opens a live session in the lobby, before the first question', () => {
    expect(lobby()).toEqual({
      ...input,
      status: 'lobby',
      current: -1,
      questionStartedAt: null,
      endedAt: null,
    });
  });

  it('opens a self-paced session at once', () => {
    const open = valueOf(createLiveSession({ ...input, kind: 'self_paced' }));
    expect(open.status).toBe('open');
  });

  it('needs a 6-digit PIN, at least one question and 5 to 120 seconds per question', () => {
    for (const pin of ['12345', '1234567', 'abcdef', '']) {
      expect(errorOf(createLiveSession({ ...input, pin }))).toEqual({
        field: 'pin',
        code: 'invalid_format',
      });
    }
    expect(errorOf(createLiveSession({ ...input, questionCount: 0 }))).toEqual({
      field: 'questionCount',
      code: 'too_short',
    });
    for (const questionSeconds of [4, 121, 7.5]) {
      expect(errorOf(createLiveSession({ ...input, questionSeconds }))).toEqual({
        field: 'questionSeconds',
        code: 'out_of_range',
      });
    }
  });
});

describe('the live game, question by question', () => {
  it('starts on the first question, reveals it, and moves on', () => {
    const first = valueOf(startGame(lobby(), at(5)));
    expect(first).toMatchObject({ status: 'question', current: 0, questionStartedAt: at(5) });

    const revealed = valueOf(revealAnswer(first));
    expect(revealed.status).toBe('reveal');

    const second = valueOf(nextQuestion(revealed, at(40)));
    expect(second).toMatchObject({ status: 'question', current: 1, questionStartedAt: at(40) });
  });

  it('ends after the last question', () => {
    let session = valueOf(startGame(lobby(), at(1)));
    for (let i = 0; i < 2; i += 1) {
      session = valueOf(nextQuestion(valueOf(revealAnswer(session)), at(10 + i)));
    }
    const ended = valueOf(nextQuestion(valueOf(revealAnswer(session)), at(30)));
    expect(ended).toMatchObject({ status: 'ended', endedAt: at(30), current: 2 });
  });

  it('refuses moves out of order', () => {
    expect(errorOf(revealAnswer(lobby()))).toEqual({
      code: 'invalid_transition',
      from: 'lobby',
      action: 'reveal',
    });
    expect(errorOf(nextQuestion(lobby(), at(1)))).toEqual({
      code: 'invalid_transition',
      from: 'lobby',
      action: 'next',
    });
    const first = valueOf(startGame(lobby(), at(1)));
    expect(errorOf(startGame(first, at(2)))).toEqual({
      code: 'invalid_transition',
      from: 'question',
      action: 'start',
    });
    const self = valueOf(createLiveSession({ ...input, kind: 'self_paced' }));
    expect(errorOf(startGame(self, at(1)))).toEqual({
      code: 'invalid_transition',
      from: 'open',
      action: 'start',
    });
  });

  it('can be ended at any time, once', () => {
    const ended = valueOf(endSession(lobby(), at(9)));
    expect(ended).toMatchObject({ status: 'ended', endedAt: at(9) });
    expect(errorOf(endSession(ended, at(10)))).toEqual({
      code: 'invalid_transition',
      from: 'ended',
      action: 'end',
    });
  });

  it('counts down the question’s time, never below zero', () => {
    const first = valueOf(startGame(lobby(), at(0)));
    expect(timeLeftMs(first, at(5))).toBe(15_000);
    expect(timeLeftMs(first, at(25))).toBe(0);
    expect(timeLeftMs(lobby(), at(5))).toBe(0);
  });
});

describe('PINs and stale sessions', () => {
  it('turns any seed into a 6-digit PIN', () => {
    expect(pinFromSeed(0)).toBe('100000');
    expect(pinFromSeed(42)).toBe('100042');
    expect(pinFromSeed(899_999)).toBe('999999');
    expect(pinFromSeed(900_000)).toBe('100000');
  });

  it('an open session is stale after 3 hours', () => {
    expect(isStaleLiveSession(lobby(), new Date(at(0).getTime() + 3 * 3600_000 - 1))).toBe(false);
    expect(isStaleLiveSession(lobby(), new Date(at(0).getTime() + 3 * 3600_000))).toBe(true);
    expect(isStaleLiveSession(valueOf(endSession(lobby(), at(1))), at(0))).toBe(false);
  });
});
