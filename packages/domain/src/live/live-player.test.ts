import { describe, expect, it } from 'vitest';
import type {
  ClassId,
  GameId,
  LivePlayerId,
  LiveSessionId,
  SchoolId,
  StudentId,
  UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import {
  answerQuestion,
  joinPlayer,
  liveLeaderboard,
  livePoints,
  questionStats,
  removePlayer,
  rosterNames,
  standingOf,
  type LiveAnswer,
  type LivePlayer,
} from './live-player.ts';
import { liveInsights } from './live-insights.ts';
import { createLiveSession, startGame, type LiveSession } from './live-session.ts';

const t0 = new Date(Date.UTC(2026, 10, 4, 10, 0, 0));
const after = (ms: number) => new Date(t0.getTime() + ms);

const session = (): LiveSession =>
  valueOf(
    startGame(
      valueOf(
        createLiveSession({
          id: 'live-1' as LiveSessionId,
          schoolId: 'school-1' as SchoolId,
          teacherId: 'teacher-1' as UserId,
          gameId: 'game-1' as GameId,
          classId: 'class-1' as ClassId,
          kind: 'live',
          mode: 'quiz',
          pin: '123456',
          seed: 1,
          questionCount: 5,
          questionSeconds: 20,
          createdAt: t0,
        }),
      ),
      t0,
    ),
  );

const player = (name: string, id = name): LivePlayer =>
  valueOf(
    joinPlayer({
      id: id as LivePlayerId,
      schoolId: 'school-1' as SchoolId,
      sessionId: 'live-1' as LiveSessionId,
      studentId: `student-${name}` as StudentId,
      firstName: name,
      tokenHash: `hash-${name}`,
      joinedAt: t0,
    }),
  );

const answer = (
  p: LivePlayer,
  question: number,
  correct: boolean,
  ms: number,
  points: number,
  prompt = `Q${String(question)}`,
): LiveAnswer => ({
  schoolId: p.schoolId,
  sessionId: p.sessionId,
  playerId: p.id,
  question,
  prompt,
  choice: correct ? 1 : 0,
  correct,
  ms,
  points,
});

describe('players', () => {
  it('join with a first name, and can be removed', () => {
    const ana = player('Ana');
    expect(ana.removedAt).toBeNull();
    expect(removePlayer(ana, after(5)).removedAt).toEqual(after(5));
    expect(errorOf(joinPlayer({ ...ana, firstName: ' ' }))).toEqual({
      field: 'firstName',
      code: 'required',
    });
  });
});

describe('livePoints', () => {
  it('gives up to 1000 for a correct answer, half at the last moment, nothing when wrong', () => {
    expect(livePoints({ correct: true, ms: 0, limitMs: 20_000, streakBefore: 0 })).toBe(1000);
    expect(livePoints({ correct: true, ms: 10_000, limitMs: 20_000, streakBefore: 0 })).toBe(750);
    expect(livePoints({ correct: true, ms: 20_000, limitMs: 20_000, streakBefore: 0 })).toBe(500);
    expect(livePoints({ correct: false, ms: 0, limitMs: 20_000, streakBefore: 3 })).toBe(0);
  });

  it('adds 100 per answer in a row before this one, up to 500', () => {
    expect(livePoints({ correct: true, ms: 0, limitMs: 20_000, streakBefore: 2 })).toBe(1200);
    expect(livePoints({ correct: true, ms: 0, limitMs: 20_000, streakBefore: 9 })).toBe(1500);
  });
});

describe('answerQuestion', () => {
  const ana = player('Ana');

  it('scores the answer by the server’s clock, with the streak so far', () => {
    const earlier = [answer(ana, 0, true, 1000, 975), answer(ana, 1, true, 1000, 1075)];
    const live = { ...session(), current: 2 };
    const recorded = valueOf(
      answerQuestion({
        session: live,
        player: ana,
        previous: earlier,
        question: 2,
        prompt: 'Q2',
        choice: 3,
        correct: true,
        now: after(4000),
      }),
    );
    expect(recorded).toEqual({
      ...answer(ana, 2, true, 4000, 0),
      choice: 3,
      points: 900 + 200,
    });
  });

  it('takes one answer per question, only for the question on screen, and only in time', () => {
    const base = {
      session: session(),
      player: ana,
      previous: [] as LiveAnswer[],
      question: 0,
      prompt: 'Q0',
      choice: 1,
      correct: true,
      now: after(1000),
    };
    expect(
      errorOf(answerQuestion({ ...base, previous: [answer(ana, 0, true, 500, 990)] })),
    ).toEqual({ field: 'answer', code: 'duplicate' });
    expect(errorOf(answerQuestion({ ...base, question: 1 }))).toEqual({
      field: 'answer',
      code: 'not_allowed',
    });
    expect(errorOf(answerQuestion({ ...base, now: after(20_001) }))).toEqual({
      field: 'answer',
      code: 'out_of_range',
    });
    expect(
      errorOf(answerQuestion({ ...base, session: { ...session(), status: 'reveal' } })),
    ).toEqual({ field: 'answer', code: 'not_allowed' });
    expect(errorOf(answerQuestion({ ...base, player: removePlayer(ana, after(1)) }))).toEqual({
      field: 'answer',
      code: 'not_allowed',
    });
  });

  it('a wrong or missed answer ends the streak', () => {
    const live = { ...session(), current: 3 };
    const previous = [
      answer(ana, 0, true, 1, 1000),
      answer(ana, 1, false, 1, 0),
      answer(ana, 2, true, 1, 1000),
    ];
    const recorded = valueOf(
      answerQuestion({
        session: live,
        player: ana,
        previous,
        question: 3,
        prompt: 'Q3',
        choice: 0,
        correct: true,
        now: after(0),
      }),
    );
    expect(recorded.points).toBe(1100);
    const skipped = valueOf(
      answerQuestion({
        session: { ...live, current: 4 },
        player: ana,
        previous,
        question: 4,
        prompt: 'Q4',
        choice: 0,
        correct: true,
        now: after(0),
      }),
    );
    expect(skipped.points).toBe(1000);
  });
});

describe('standings, leaderboard and question stats', () => {
  const ana = player('Ana');
  const ben = player('Ben');
  const cara = player('Cara');
  const answers = [
    answer(ana, 0, true, 2000, 950),
    answer(ana, 1, true, 3000, 1025),
    answer(ben, 0, true, 1000, 975),
    answer(ben, 1, false, 4000, 0),
    answer(cara, 0, false, 5000, 0),
  ];

  it('totals each player’s points, correct answers, streaks and time', () => {
    expect(standingOf(ana.id, answers)).toEqual({
      score: 1975,
      correct: 2,
      answered: 2,
      streak: 2,
      bestStreak: 2,
      totalMs: 5000,
    });
    expect(standingOf(ben.id, answers)).toMatchObject({ streak: 0, bestStreak: 1 });
  });

  it('ranks by points, then by less time, and leaves out removed players', () => {
    const board = liveLeaderboard([ana, ben, cara, removePlayer(player('Dan'), t0)], answers);
    expect(board.map((row) => [row.rank, row.firstName, row.score])).toEqual([
      [1, 'Ana', 1975],
      [2, 'Ben', 975],
      [3, 'Cara', 0],
    ]);
    const tie = liveLeaderboard(
      [ana, ben],
      [answer(ana, 0, true, 3000, 900), answer(ben, 0, true, 2000, 900)],
    );
    expect(tie.map((row) => row.firstName)).toEqual(['Ben', 'Ana']);
  });

  it('counts how a question was answered', () => {
    expect(questionStats(answers, 0, 4)).toEqual({
      answered: 3,
      correct: 2,
      percentCorrect: 67,
      distribution: [1, 2, 0, 0],
    });
    expect(questionStats(answers, 4, 2)).toEqual({
      answered: 0,
      correct: 0,
      percentCorrect: null,
      distribution: [0, 0],
    });
  });
});

describe('liveInsights', () => {
  it('summarises a game’s sessions: hardest questions first, each student’s accuracy', () => {
    const ana = player('Ana', 'p-ana-1');
    const ben = player('Ben', 'p-ben-1');
    const ana2 = { ...player('Ana', 'p-ana-2'), sessionId: 'live-2' as LiveSessionId };
    const answers = [
      answer(ana, 0, true, 1, 1000, 'Largest planet?'),
      answer(ana, 1, false, 1, 0, 'Red planet?'),
      answer(ben, 0, true, 1, 1000, 'Largest planet?'),
      answer(ben, 1, false, 1, 0, 'Red planet?'),
      { ...answer(ana2, 0, true, 1, 1000, 'Red planet?'), sessionId: 'live-2' as LiveSessionId },
    ];

    expect(liveInsights(2, [ana, ben, ana2], answers)).toEqual({
      sessions: 2,
      participants: 2,
      averageAccuracy: 60,
      questions: [
        { prompt: 'Red planet?', answered: 3, percentCorrect: 33 },
        { prompt: 'Largest planet?', answered: 2, percentCorrect: 100 },
      ],
      students: [
        { studentId: ana.studentId, firstName: 'Ana', sessions: 2, answered: 3, accuracy: 67 },
        { studentId: ben.studentId, firstName: 'Ben', sessions: 1, answered: 2, accuracy: 50 },
      ],
    });
  });

  it('is empty before anyone has played', () => {
    expect(liveInsights(0, [], [])).toEqual({
      sessions: 0,
      participants: 0,
      averageAccuracy: null,
      questions: [],
      students: [],
    });
  });
});

describe('rosterNames', () => {
  const student = (id: string, firstName: string, lastName: string) => ({
    id: id as StudentId,
    firstName,
    lastName,
  });

  it('shows first names, adding the last initial only where two match', () => {
    expect(
      rosterNames([
        student('s1', 'Ana', 'Zayas'),
        student('s2', 'Ben', 'Acosta'),
        student('s3', 'ana', 'Morales'),
      ]),
    ).toEqual([
      { studentId: 's3', name: 'ana M.' },
      { studentId: 's1', name: 'Ana Z.' },
      { studentId: 's2', name: 'Ben' },
    ]);
  });
});
