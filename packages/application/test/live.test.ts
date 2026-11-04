import { describe, expect, it } from 'vitest';
import {
  defaultGameModes,
  isCorrectLiveAnswer,
  liveQuestions,
  type Game,
  type LiveSession,
  type LiveSessionId,
} from '@thp/domain';
import { aUser, sampleGameContent } from '@thp/testing';
import {
  CreateGame,
  DeleteLiveSession,
  EndLiveSession,
  FindLiveSessionByPin,
  FinishSelfPacedRound,
  GetLiveInsights,
  GetLiveView,
  JoinLiveSession,
  ListLiveSessions,
  NextLiveQuestion,
  OpenLiveHost,
  RemoveLivePlayer,
  RevealLiveAnswer,
  StartLiveGame,
  StartLiveSession,
  StartSelfPacedRound,
  SubmitLiveAnswer,
  VerifyLiveTicket,
  type LiveActor,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, type World } from './world.ts';

const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };

async function setUp(world: World) {
  const setup = await gradedClass(world);
  const game = valueOf(
    await new CreateGame(world).execute({
      actor: setup.actor,
      title: 'Planets',
      mode: 'quiz',
      content: sampleGameContent.questions,
      classId: setup.cls.id,
    }),
  );
  const session = valueOf(
    await new StartLiveSession(world).execute({
      actor: setup.actor,
      gameId: game.id,
      classId: setup.cls.id,
      kind: 'live',
    }),
  );
  const host = valueOf(
    await new VerifyLiveTicket(world).execute({
      ticket: valueOf(
        await new OpenLiveHost(world).execute({ actor: setup.actor, sessionId: session.id }),
      ).ticket,
    }),
  );
  const join = async (studentId: string) => {
    const joined = valueOf(
      await new JoinLiveSession(world).execute({ pin: session.pin, studentId }),
    );
    return {
      ...joined,
      actor: valueOf(await new VerifyLiveTicket(world).execute({ ticket: joined.ticket })),
    };
  };
  return { ...setup, game, session, host, join };
}

/** The right choice for a question of the session. */
const rightChoice = (game: Game, session: LiveSession, question: number) =>
  (
    liveQuestions(game, session.mode, session.seed, defaultGameModes)?.[question]?.options ?? []
  ).findIndex((_, c) =>
    isCorrectLiveAnswer(game, session.mode, session.seed, question, c, defaultGameModes),
  );

const view = async (world: World, actor: LiveActor) =>
  valueOf(await new GetLiveView(world).execute({ actor }));

describe('Live sessions: starting and joining', () => {
  it('a teacher starts a live session of a game for a class, with a 6-digit PIN', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(s.session).toMatchObject({
      kind: 'live',
      mode: 'quiz',
      status: 'lobby',
      questionCount: 4,
      questionSeconds: 20,
      classId: s.cls.id,
    });
    expect(s.session.pin).toMatch(/^\d{6}$/);
    expect(
      (await new ListLiveSessions(world).execute({ actor: s.actor })).map((x) => x.id),
    ).toEqual([s.session.id]);
  });

  it('refuses a mode that cannot run live, a class the teacher does not manage, and another teacher’s game', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const base = { actor: s.actor, gameId: s.game.id, classId: s.cls.id, kind: 'live' };
    expect(await new StartLiveSession(world).execute({ ...base, mode: 'memory' })).toEqual({
      ok: false,
      error: { field: 'mode', code: 'not_allowed' },
    });
    expect(await new StartLiveSession(world).execute({ ...base, kind: 'party' })).toEqual({
      ok: false,
      error: { field: 'kind', code: 'invalid_format' },
    });
    expect(
      await new StartLiveSession(world).execute({ ...base, actor: colleagueOf(s.actor) }),
    ).toEqual(forbidden);
    expect(
      await new StartLiveSession(world).execute({ ...base, classId: 'class-x' as never }),
    ).toEqual(notFound);
  });

  it('a student finds the session by PIN and sees only first names, greyed out once taken', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    await s.join(s.ana.id);
    const found = valueOf(
      await new FindLiveSessionByPin(world).execute({ pin: ` ${s.session.pin} ` }),
    );
    expect(found).toMatchObject({ sessionId: s.session.id, title: 'Planets' });
    expect(found.names).toEqual([
      { studentId: s.ana.id, name: 'Ana', taken: true },
      { studentId: s.ben.id, name: 'Ben', taken: false },
      { studentId: s.cara.id, name: 'Cara', taken: false },
    ]);
    expect(JSON.stringify(found)).not.toMatch(/Zayas|Acosta|Morales/);
    expect(await new FindLiveSessionByPin(world).execute({ pin: '000000' })).toEqual(notFound);
  });

  it('a taken name cannot be claimed again, except by the same device with its reconnect token', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    expect(
      await new JoinLiveSession(world).execute({ pin: s.session.pin, studentId: s.ana.id }),
    ).toEqual({ ok: false, error: { code: 'name_taken' } });
    expect(
      await new JoinLiveSession(world).execute({
        pin: s.session.pin,
        studentId: s.ana.id,
        reconnectToken: 'wrong',
      }),
    ).toEqual({ ok: false, error: { code: 'name_taken' } });
    const again = valueOf(
      await new JoinLiveSession(world).execute({
        pin: s.session.pin,
        studentId: s.ana.id,
        reconnectToken: ana.reconnectToken,
      }),
    );
    expect(again.playerId).toBe(ana.playerId);
  });

  it('two devices tapping the same name at once: the second is told the name is taken', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const racing = {
      ...world,
      livePlayers: Object.assign(Object.create(world.livePlayers) as typeof world.livePlayers, {
        save: () => Promise.reject(new Error('duplicate key')),
      }),
    };
    expect(
      await new JoinLiveSession(racing).execute({ pin: s.session.pin, studentId: s.ben.id }),
    ).toEqual({ ok: false, error: { code: 'name_taken' } });
  });

  it('only the class’s students can join, and only an open session', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(
      await new JoinLiveSession(world).execute({ pin: s.session.pin, studentId: 'student-x' }),
    ).toEqual(notFound);
    valueOf(await new EndLiveSession(world).execute({ actor: s.host }));
    expect(
      await new JoinLiveSession(world).execute({ pin: s.session.pin, studentId: s.ben.id }),
    ).toEqual(notFound);
  });

  it('a session left open for 3 hours closes itself and can no longer be found', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    world.clock.advanceBy(3 * 60 * 60 * 1000);
    expect(await new FindLiveSessionByPin(world).execute({ pin: s.session.pin })).toEqual(notFound);
    expect((await world.liveSessions.findById(s.actor.schoolId, s.session.id))?.status).toBe(
      'ended',
    );
  });

  it('tickets cannot be forged, and a removed player’s ticket stops working', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(await new VerifyLiveTicket(world).execute({ ticket: 'forged.ticket.here' })).toEqual({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    const ben = await s.join(s.ben.id);
    valueOf(await new RemoveLivePlayer(world).execute({ actor: s.host, playerId: ben.playerId }));
    expect(await new VerifyLiveTicket(world).execute({ ticket: ben.ticket })).toEqual({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    world.clock.advanceBy(5 * 60 * 60 * 1000);
    const hostTicket = valueOf(
      await new OpenLiveHost(world).execute({ actor: s.actor, sessionId: s.session.id }),
    ).ticket;
    world.clock.advanceBy(5 * 60 * 60 * 1000);
    expect(await new VerifyLiveTicket(world).execute({ ticket: hostTicket })).toEqual({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('another teacher or school cannot open, delete or read the session', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const outsider = aUser({
      id: 'outsider' as never,
      schoolId: 'school-x' as never,
      role: 'school_admin',
    });
    const ref = { sessionId: s.session.id };
    expect(await new OpenLiveHost(world).execute({ ...ref, actor: colleagueOf(s.actor) })).toEqual(
      forbidden,
    );
    expect(await new OpenLiveHost(world).execute({ ...ref, actor: outsider })).toEqual(notFound);
    expect(await new DeleteLiveSession(world).execute({ ...ref, actor: outsider })).toEqual(
      notFound,
    );
    expect(
      await new GetLiveInsights(world).execute({ actor: outsider, gameId: s.game.id }),
    ).toEqual(notFound);
    expect(await new ListLiveSessions(world).execute({ actor: outsider })).toEqual([]);
  });
});

describe('Live sessions: playing', () => {
  it('the host runs the questions; answers are timed and scored on the server; the leaderboard ranks them', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    const ben = await s.join(s.ben.id);
    const cara = await s.join(s.cara.id);
    valueOf(await new StartLiveGame(world).execute({ actor: s.host }));

    const lobbyView = await view(world, ana.actor);
    expect(lobbyView).toMatchObject({ status: 'question', current: 0, pin: null, reveal: null });
    expect(JSON.stringify(lobbyView.question)).not.toContain('answer');

    for (let q = 0; q < 4; q += 1) {
      const right = rightChoice(s.game, s.session, q);
      world.clock.advanceBy(2000);
      valueOf(
        await new SubmitLiveAnswer(world).execute({ actor: ana.actor, question: q, choice: right }),
      );
      world.clock.advanceBy(2000);
      valueOf(
        await new SubmitLiveAnswer(world).execute({
          actor: ben.actor,
          question: q,
          choice: q % 2 === 0 ? right : (right + 1) % 2,
        }),
      );
      const last = await new SubmitLiveAnswer(world).execute({
        actor: cara.actor,
        question: q,
        choice: 99,
      });
      expect(valueOf(last).revealed).toBe(true);
      const revealed = await view(world, s.host);
      expect(revealed.status).toBe('reveal');
      expect(revealed.reveal).toMatchObject({ correctChoice: right, stats: { answered: 3 } });
      valueOf(await new NextLiveQuestion(world).execute({ actor: s.host }));
    }

    const end = await view(world, s.host);
    expect(end.status).toBe('ended');
    expect(end.leaderboard.map((row) => [row.firstName, row.correct])).toEqual([
      ['Ana', 4],
      ['Ben', 2],
      ['Cara', 0],
    ]);
    expect(end.leaderboard[0]?.score).toBeGreaterThan(end.leaderboard[1]?.score ?? 0);
    const anaView = await view(world, ana.actor);
    expect(anaView.you).toMatchObject({ firstName: 'Ana', rank: 1, correct: 4, streak: 4 });
  });

  it('one answer per question, only in time, and only from players', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    await s.join(s.ben.id);
    valueOf(await new StartLiveGame(world).execute({ actor: s.host }));
    const submit = (choice: number, question = 0) =>
      new SubmitLiveAnswer(world).execute({ actor: ana.actor, question, choice });

    valueOf(await submit(0));
    expect(await submit(1)).toEqual({ ok: false, error: { field: 'answer', code: 'duplicate' } });
    expect(await submit(0, 1)).toEqual({
      ok: false,
      error: { field: 'answer', code: 'not_allowed' },
    });
    expect(
      await new SubmitLiveAnswer(world).execute({ actor: s.host, question: 0, choice: 0 }),
    ).toEqual(forbidden);
    expect(await new NextLiveQuestion(world).execute({ actor: ana.actor })).toEqual(forbidden);
    expect(await new StartLiveGame(world).execute({ actor: ana.actor })).toEqual(forbidden);
  });

  it('the timer reveals a question once its time is up, and a stale timer does nothing', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    valueOf(await new StartLiveGame(world).execute({ actor: s.host }));
    world.clock.advanceBy(21_000);
    expect(
      await new SubmitLiveAnswer(world).execute({ actor: ana.actor, question: 0, choice: 0 }),
    ).toEqual({ ok: false, error: { field: 'answer', code: 'out_of_range' } });

    const system: LiveActor = {
      role: 'system',
      schoolId: s.actor.schoolId,
      sessionId: s.session.id,
    };
    valueOf(await new RevealLiveAnswer(world).execute({ actor: system, question: 0 }));
    expect((await view(world, s.host)).status).toBe('reveal');
    valueOf(await new NextLiveQuestion(world).execute({ actor: s.host }));
    const stale = valueOf(
      await new RevealLiveAnswer(world).execute({ actor: system, question: 0 }),
    );
    expect(stale.status).toBe('question');
  });

  it('the host sees the PIN and the players; a removed player leaves the board', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    const ben = await s.join(s.ben.id);
    valueOf(await new RemoveLivePlayer(world).execute({ actor: s.host, playerId: ben.playerId }));
    const hostView = await view(world, s.host);
    expect(hostView.pin).toBe(s.session.pin);
    expect(hostView.players.map((p) => p.firstName)).toEqual(['Ana']);
    expect((await view(world, ana.actor)).pin).toBeNull();
    expect(
      await new RemoveLivePlayer(world).execute({ actor: ana.actor, playerId: ana.playerId }),
    ).toEqual(forbidden);
  });

  it('a self-paced session: each student plays rounds and the host sees their best', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const selfPaced = valueOf(
      await new StartLiveSession(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        classId: s.cls.id,
        kind: 'self_paced',
      }),
    );
    expect(selfPaced.status).toBe('open');
    const joined = valueOf(
      await new JoinLiveSession(world).execute({ pin: selfPaced.pin, studentId: s.ana.id }),
    );
    const ana = valueOf(await new VerifyLiveTicket(world).execute({ ticket: joined.ticket }));
    const round = valueOf(await new StartSelfPacedRound(world).execute({ actor: ana }));
    const perfect = world.gameModes.get(round.mode)?.solve(s.game.content, round.seed);
    const result = valueOf(
      await new FinishSelfPacedRound(world).execute({
        actor: ana,
        mode: round.mode,
        seed: round.seed,
        answers: perfect,
        durationMs: 30_000,
      }),
    );
    expect(result).toMatchObject({ score: 4, total: 4, percent: 100 });
    const host = valueOf(
      await new VerifyLiveTicket(world).execute({
        ticket: valueOf(
          await new OpenLiveHost(world).execute({ actor: s.actor, sessionId: selfPaced.id }),
        ).ticket,
      }),
    );
    expect((await view(world, host)).selfPaced).toEqual([
      { playerId: joined.playerId, firstName: 'Ana', plays: 1, bestPercent: 100 },
    ]);
    expect(await new StartSelfPacedRound(world).execute({ actor: s.host })).toEqual(forbidden);
    expect(await new StartLiveGame(world).execute({ actor: host })).toEqual({
      ok: false,
      error: { field: 'status', code: 'not_allowed' },
    });
  });
});

describe('Live sessions: insights and deleting', () => {
  it('insights show each question’s % correct and each student’s accuracy, never grades', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    const ben = await s.join(s.ben.id);
    valueOf(await new StartLiveGame(world).execute({ actor: s.host }));
    const right = rightChoice(s.game, s.session, 0);
    valueOf(
      await new SubmitLiveAnswer(world).execute({ actor: ana.actor, question: 0, choice: right }),
    );
    valueOf(
      await new SubmitLiveAnswer(world).execute({
        actor: ben.actor,
        question: 0,
        choice: (right + 1) % 2,
      }),
    );
    valueOf(await new EndLiveSession(world).execute({ actor: s.host }));

    const insights = valueOf(
      await new GetLiveInsights(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    expect(insights).toMatchObject({ sessions: 1, participants: 2, averageAccuracy: 50 });
    expect(insights.questions).toHaveLength(1);
    expect(insights.questions[0]?.percentCorrect).toBe(50);
    expect(insights.students.map((st) => [st.firstName, st.accuracy])).toEqual([
      ['Ana', 100],
      ['Ben', 0],
    ]);
    expect(await world.grades.listByStudent(s.actor.schoolId, s.ana.id)).toEqual([]);
  });

  it('deleting a session removes its players and answers', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = await s.join(s.ana.id);
    valueOf(await new StartLiveGame(world).execute({ actor: s.host }));
    valueOf(
      await new SubmitLiveAnswer(world).execute({ actor: ana.actor, question: 0, choice: 0 }),
    );
    valueOf(
      await new DeleteLiveSession(world).execute({ actor: s.actor, sessionId: s.session.id }),
    );
    expect(await world.liveSessions.findById(s.actor.schoolId, s.session.id)).toBeNull();
    expect(await world.livePlayers.listBySessions(s.actor.schoolId, [s.session.id])).toEqual([]);
    expect(await world.liveAnswers.listBySessions(s.actor.schoolId, [s.session.id])).toEqual([]);
    expect(
      await new GetLiveView(world).execute({
        actor: { role: 'system', schoolId: s.actor.schoolId, sessionId: 'gone' as LiveSessionId },
      }),
    ).toEqual(notFound);
  });

  it('insights for a game with no sessions are empty', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const other = valueOf(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Stars',
        mode: 'quiz',
        content: sampleGameContent.questions,
      }),
    );
    expect(
      valueOf(await new GetLiveInsights(world).execute({ actor: s.actor, gameId: other.id })),
    ).toMatchObject({ sessions: 0, participants: 0, averageAccuracy: null });
  });
});
