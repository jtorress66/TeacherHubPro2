import { describe, expect, it } from 'vitest';
import type { ClassId, Game, JobId, StudentId } from '@thp/domain';
import { aUser, FakeGameWriter, sampleGameContent } from '@thp/testing';
import {
  ConfirmGameGrades,
  CreateGame,
  DeleteGame,
  FinishGameRound,
  FinishPreviewRound,
  GameDraftHandler,
  GetGame,
  GetGameDraft,
  GetGameLeaderboard,
  GetGameResults,
  GetGradebook,
  IssueLinks,
  ListGames,
  OpenStudentLink,
  RequestGameDraft,
  SaveGameGrading,
  StartGameRound,
  StartPreviewRound,
  UpdateGame,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

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
  const issued = valueOf(
    await new IssueLinks(world).execute({ actor: setup.actor, classId: setup.cls.id }),
  );
  const tokenOf = (studentId: StudentId) =>
    issued.find((row) => row.student.id === studentId)?.token ?? '';
  return {
    ...setup,
    game,
    anaToken: tokenOf(setup.ana.id),
    benToken: tokenOf(setup.ben.id),
  };
}

/** Plays a round from a student's link with perfect answers for the first `right` questions. */
async function play(world: World, token: string, game: Game, right: number, durationMs = 30_000) {
  const gameId = game.id;
  const round = valueOf(await new StartGameRound(world).execute({ token, gameId }));
  const mode = world.gameModes.get(round.mode);
  if (mode === null) throw new Error('missing');
  const perfect = mode.solve(game.content, round.seed) as number[];
  return valueOf(
    await new FinishGameRound(world).execute({
      token,
      gameId,
      mode: round.mode,
      seed: round.seed,
      answers: perfect.map((answer, i) => (i < right ? answer : -1)),
      durationMs,
    }),
  );
}

describe('Games: creating and managing', () => {
  it('a teacher creates, lists, updates and deletes their games', async () => {
    const world = makeWorld();
    const s = await setUp(world);

    expect((await new ListGames(world).execute({ actor: s.actor })).map((g) => g.title)).toEqual([
      'Planets',
    ]);
    const updated = valueOf(
      await new UpdateGame(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        changes: { title: 'Space quiz', mode: 'time_attack' },
      }),
    );
    expect(updated).toMatchObject({ title: 'Space quiz', mode: 'time_attack' });
    expect(
      valueOf(await new GetGame(world).execute({ actor: s.actor, gameId: s.game.id })),
    ).toMatchObject({ game: { title: 'Space quiz' }, modes: ['time_attack'] });

    await play(world, s.anaToken, s.game, 2);
    valueOf(await new DeleteGame(world).execute({ actor: s.actor, gameId: s.game.id }));
    expect(await new GetGame(world).execute({ actor: s.actor, gameId: s.game.id })).toEqual(
      notFound,
    );
    expect(await world.gamePlays.listByGame(s.actor.schoolId, s.game.id)).toEqual([]);
  });

  it('checks the game like the domain does, in the teacher’s language by default', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(s.game.language).toBe('es');
    expect(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Quiz',
        mode: 'quiz',
        content: sampleGameContent.questions,
      }),
    ).toEqual({ ok: false, error: { field: 'title', code: 'not_allowed' } });
  });

  it('only shares a game with a class the teacher manages', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const colleague = colleagueOf(s.actor);
    await world.users.save(colleague);
    const input = { title: 'Mine', mode: 'quiz', content: sampleGameContent.questions };

    expect(
      await new CreateGame(world).execute({ ...input, actor: colleague, classId: s.cls.id }),
    ).toEqual(forbidden);
    expect(
      await new CreateGame(world).execute({
        ...input,
        actor: s.actor,
        classId: 'class-x' as ClassId,
      }),
    ).toEqual(notFound);
  });

  it('another teacher cannot see or change a game; an admin of the school can', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const colleague = colleagueOf(s.actor);
    const admin = colleagueOf(s.actor, 'school_admin');
    const ref = { gameId: s.game.id };

    expect(await new GetGame(world).execute({ ...ref, actor: colleague })).toEqual(forbidden);
    expect(
      await new UpdateGame(world).execute({ ...ref, actor: colleague, changes: { title: 'Mine' } }),
    ).toEqual(forbidden);
    expect(await new DeleteGame(world).execute({ ...ref, actor: colleague })).toEqual(forbidden);
    expect((await new GetGame(world).execute({ ...ref, actor: admin })).ok).toBe(true);
  });

  it('another school’s game is unreachable', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const outsider = aUser({
      id: 'outsider' as never,
      schoolId: 'school-x' as never,
      role: 'school_admin',
    });
    const ref = { actor: outsider, gameId: s.game.id };

    expect(await new GetGame(world).execute(ref)).toEqual(notFound);
    expect(await new DeleteGame(world).execute(ref)).toEqual(notFound);
    expect(await new GetGameResults(world).execute(ref)).toEqual(notFound);
    expect(await new StartPreviewRound(world).execute(ref)).toEqual(notFound);
    expect(await new ListGames(world).execute({ actor: outsider })).toEqual([]);
  });
});

describe('Games: AI drafts', () => {
  const draftInput = { kind: 'pairs', subject: 'science', grade: '4', topic: 'Space' };

  it('needs AI access', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    advanceDays(world, 8);
    expect(await new RequestGameDraft(world).execute({ ...draftInput, actor: s.actor })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });

  it('queues a draft in the teacher’s language that the writer fills and the teacher reads', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const job = valueOf(
      await new RequestGameDraft(world).execute({ ...draftInput, actor: s.actor }),
    );
    expect(job.kind).toBe('game.generate');

    const claimed = await world.jobs.claimNext(['game.generate']);
    if (claimed === null) throw new Error('no job');
    const result = await new GameDraftHandler(world).handle(claimed);
    expect(world.gameWriter.requests[0]).toMatchObject({
      kind: 'pairs',
      topic: 'Space',
      language: 'es',
    });
    expect(JSON.stringify(world.gameWriter.requests)).not.toContain('Zayas');
    await world.jobs.complete(claimed.id, valueOf(result));

    const draft = valueOf(await new GetGameDraft(world).execute({ actor: s.actor, jobId: job.id }));
    expect(draft).toMatchObject({ content: sampleGameContent.pairs, gameId: null });
    const colleague = colleagueOf(s.actor);
    expect(await new GetGameDraft(world).execute({ actor: colleague, jobId: job.id })).toEqual(
      notFound,
    );
    expect(
      await new GetGameDraft(world).execute({ actor: s.actor, jobId: 'job-x' as JobId }),
    ).toEqual(notFound);
  });

  it('asks for fresh items of the game’s kind, avoiding the ones it has', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const job = valueOf(
      await new RequestGameDraft(world).execute({
        ...draftInput,
        actor: s.actor,
        gameId: s.game.id,
      }),
    );
    const payload = job.payload as { gameId: string; request: { kind: string; avoid: string[] } };
    expect(payload.gameId).toBe(s.game.id);
    expect(payload.request.kind).toBe('questions');
    expect(payload.request.avoid).toContain('Which is the largest planet?');
    expect(
      await new RequestGameDraft(world).execute({
        ...draftInput,
        actor: colleagueOf(s.actor),
        gameId: s.game.id,
      }),
    ).toEqual(forbidden);
  });

  it('a failed draft fails the job', async () => {
    const world = { ...makeWorld(), gameWriter: new FakeGameWriter('ai_unavailable') };
    const s = await setUp(world);
    valueOf(await new RequestGameDraft(world).execute({ ...draftInput, actor: s.actor }));
    const claimed = await world.jobs.claimNext(['game.generate']);
    if (claimed === null) throw new Error('no job');
    expect(await new GameDraftHandler(world).handle(claimed)).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });

  it('rejects a bad request', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(
      await new RequestGameDraft(world).execute({ ...draftInput, actor: s.actor, kind: 'riddles' }),
    ).toEqual({ ok: false, error: { field: 'kind', code: 'invalid_format' } });
  });
});

describe('Games: playing from a student link', () => {
  it('the portal lists the class’s games', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    valueOf(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Not shared',
        mode: 'quiz',
        content: sampleGameContent.questions,
      }),
    );
    const portal = valueOf(await new OpenStudentLink(world).execute({ token: s.anaToken }));
    expect(portal.games).toEqual([{ id: s.game.id, title: 'Planets', modes: ['quiz'] }]);
  });

  it('starts a round without answers, and scores the answers on the server', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const round = valueOf(
      await new StartGameRound(world).execute({ token: s.anaToken, gameId: s.game.id }),
    );
    expect(round).toMatchObject({
      gameId: s.game.id,
      title: 'Planets',
      mode: 'quiz',
      modes: ['quiz'],
    });
    expect(JSON.stringify(round.view)).not.toContain('"answer"');

    const result = await play(world, s.anaToken, s.game, 3, 61_000);
    expect(result).toMatchObject({ score: 3, total: 4, percent: 75 });
    expect(await world.gamePlays.listByGame(s.actor.schoolId, s.game.id)).toMatchObject([
      {
        studentId: s.ana.id,
        classId: s.cls.id,
        score: 3,
        total: 4,
        durationMs: 61_000,
        mode: 'quiz',
      },
    ]);
  });

  it('play again gives a new round', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const start = () => new StartGameRound(world).execute({ token: s.anaToken, gameId: s.game.id });
    const first = valueOf(await start());
    const second = valueOf(await start());
    expect(second.seed).not.toBe(first.seed);
  });

  it('keeps the time taken within reason and refuses a mode or seed it did not offer', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const base = { token: s.anaToken, gameId: s.game.id, mode: 'quiz', seed: 5, answers: [] };
    const result = valueOf(
      await new FinishGameRound(world).execute({ ...base, durationMs: -40.5 }),
    );
    expect(result.score).toBe(0);
    const [saved] = await world.gamePlays.listByGame(s.actor.schoolId, s.game.id);
    expect(saved?.durationMs).toBe(0);

    expect(
      await new FinishGameRound(world).execute({ ...base, mode: 'memory', durationMs: 1 }),
    ).toEqual({
      ok: false,
      error: { field: 'mode', code: 'not_allowed' },
    });
    expect(await new FinishGameRound(world).execute({ ...base, seed: -1, durationMs: 1 })).toEqual({
      ok: false,
      error: { field: 'seed', code: 'out_of_range' },
    });
    expect(
      await new StartGameRound(world).execute({
        token: s.anaToken,
        gameId: s.game.id,
        mode: 'memory',
      }),
    ).toEqual({
      ok: false,
      error: { field: 'mode', code: 'not_allowed' },
    });
  });

  it('a link only opens its own class’s games', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const other = valueOf(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Elsewhere',
        mode: 'quiz',
        content: sampleGameContent.questions,
      }),
    );
    expect(
      await new StartGameRound(world).execute({ token: s.anaToken, gameId: other.id }),
    ).toEqual(notFound);
    expect(await new StartGameRound(world).execute({ token: 'bad', gameId: s.game.id })).toEqual(
      notFound,
    );
    expect(
      await new GetGameLeaderboard(world).execute({ token: s.anaToken, gameId: other.id }),
    ).toEqual(notFound);
    expect(
      await new FinishGameRound(world).execute({
        token: s.anaToken,
        gameId: other.id,
        mode: 'quiz',
        seed: 1,
        answers: [],
        durationMs: 1,
      }),
    ).toEqual(notFound);
  });

  it('an "all modes" game lets the student choose any mode that suits it', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const all = valueOf(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Space words',
        mode: 'all',
        content: sampleGameContent.pairs,
        classId: s.cls.id,
      }),
    );
    const round = valueOf(
      await new StartGameRound(world).execute({
        token: s.anaToken,
        gameId: all.id,
        mode: 'memory',
      }),
    );
    expect(round.mode).toBe('memory');
    expect(round.modes).toContain('word_search');
    const first = valueOf(
      await new StartGameRound(world).execute({ token: s.anaToken, gameId: all.id }),
    );
    expect(first.mode).toBe('quiz');
  });
});

describe('Games: previews', () => {
  it('a teacher previews and scores a round, and nothing is saved', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const round = valueOf(
      await new StartPreviewRound(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    const mode = world.gameModes.get(round.mode);
    const answers = mode?.solve(s.game.content, round.seed);
    const result = valueOf(
      await new FinishPreviewRound(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        mode: round.mode,
        seed: round.seed,
        answers,
      }),
    );
    expect(result).toMatchObject({ score: 4, total: 4, percent: 100 });
    expect(await world.gamePlays.listByGame(s.actor.schoolId, s.game.id)).toEqual([]);
    expect(
      await new StartPreviewRound(world).execute({
        actor: colleagueOf(s.actor),
        gameId: s.game.id,
      }),
    ).toEqual(forbidden);
  });
});

describe('Games: results, leaderboard and grades', () => {
  it('students see their class’s leaderboard by first name, and which row is theirs', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    await play(world, s.anaToken, s.game, 2);
    await play(world, s.benToken, s.game, 4);
    await play(world, s.anaToken, s.game, 3);

    const board = valueOf(
      await new GetGameLeaderboard(world).execute({ token: s.anaToken, gameId: s.game.id }),
    );
    expect(board).toEqual([
      { rank: 1, name: 'Ben', percent: 100, durationMs: 30_000, you: false },
      { rank: 2, name: 'Ana', percent: 75, durationMs: 30_000, you: true },
    ]);
    expect(JSON.stringify(board)).not.toMatch(/Zayas|Acosta|student/);
  });

  it('the teacher sees full names, stats, the summary and each student’s draft grade', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    await play(world, s.anaToken, s.game, 2);
    await play(world, s.anaToken, s.game, 4);
    await play(world, s.benToken, s.game, 1);
    valueOf(
      await new SaveGameGrading(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        countAsGrade: true,
        method: 'average',
        points: 20,
        categoryId: s.category('Pruebas cortas'),
      }),
    );

    const results = valueOf(
      await new GetGameResults(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    expect(results.summary).toEqual({ plays: 3, students: 2, averagePercent: 58 });
    expect(results.leaderboard.map((e) => e.name)).toEqual(['Ana Zayas', 'Ben Acosta']);
    expect(results.students).toEqual([
      expect.objectContaining({
        name: 'Ana Zayas',
        attempts: 2,
        bestPercent: 100,
        draftScore: 15,
        confirmedScore: null,
      }),
      expect.objectContaining({
        name: 'Ben Acosta',
        attempts: 1,
        bestPercent: 25,
        draftScore: 5,
        confirmedScore: null,
      }),
    ]);
  });

  it('grading creates a gradebook assignment once, in a category of the game’s class', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const grading = {
      actor: s.actor,
      gameId: s.game.id,
      countAsGrade: true,
      method: 'best',
      points: 10,
      categoryId: s.category('Tareas'),
    };
    const first = valueOf(await new SaveGameGrading(world).execute(grading));
    const assignmentId = first.grading.assignmentId;
    expect(assignmentId).not.toBeNull();
    const again = valueOf(await new SaveGameGrading(world).execute({ ...grading, points: 15 }));
    expect(again.grading.assignmentId).toBe(assignmentId);
    const assignments = await world.assignments.listByClass(s.actor.schoolId, s.cls.id);
    expect(assignments.filter((a) => a.title === 'Planets')).toMatchObject([{ points: 15 }]);

    const off = valueOf(
      await new SaveGameGrading(world).execute({ ...grading, countAsGrade: false }),
    );
    expect(off.grading).toMatchObject({ countAsGrade: false, assignmentId });

    expect(
      await new SaveGameGrading(world).execute({ ...grading, categoryId: 'cat-x' as never }),
    ).toEqual(notFound);
    expect(
      await new SaveGameGrading(world).execute({ ...grading, actor: colleagueOf(s.actor) }),
    ).toEqual(forbidden);
  });

  it('a game without a class cannot count as a grade', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const loose = valueOf(
      await new CreateGame(world).execute({
        actor: s.actor,
        title: 'Loose',
        mode: 'quiz',
        content: sampleGameContent.questions,
      }),
    );
    expect(
      await new SaveGameGrading(world).execute({
        actor: s.actor,
        gameId: loose.id,
        countAsGrade: true,
        method: 'best',
        points: 10,
        categoryId: s.category('Tareas'),
      }),
    ).toEqual({ ok: false, error: { field: 'classId', code: 'required' } });
  });

  it('the teacher confirms the game’s grades in one click, adjusting any, and they reach the gradebook', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    await play(world, s.anaToken, s.game, 4);
    await play(world, s.benToken, s.game, 2);
    expect(
      await new ConfirmGameGrades(world).execute({ actor: s.actor, gameId: s.game.id }),
    ).toEqual({
      ok: false,
      error: { code: 'grading_off' },
    });
    valueOf(
      await new SaveGameGrading(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        countAsGrade: true,
        method: 'best',
        points: 10,
        categoryId: s.category('Tareas'),
      }),
    );

    const grades = valueOf(
      await new ConfirmGameGrades(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        scores: { [s.ben.id]: 6 },
      }),
    );
    expect(grades.map((g) => [g.studentId, g.score, g.source])).toEqual([
      [s.ana.id, 10, 'game'],
      [s.ben.id, 6, 'game'],
    ]);

    const results = valueOf(
      await new GetGameResults(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    expect(results.students.map((r) => r.confirmedScore)).toEqual([10, 6]);
    const book = valueOf(
      await new GetGradebook(world).execute({ actor: s.actor, classId: s.cls.id }),
    );
    expect(JSON.stringify(book)).toContain('Planets');

    const again = valueOf(
      await new ConfirmGameGrades(world).execute({ actor: s.actor, gameId: s.game.id }),
    );
    expect(again.map((g) => g.id)).toEqual(grades.map((g) => g.id));
    expect(
      await new ConfirmGameGrades(world).execute({
        actor: s.actor,
        gameId: s.game.id,
        scores: { [s.ana.id]: 11 },
      }),
    ).toEqual({ ok: false, error: { field: 'score', code: 'out_of_range' } });
    expect(
      await new ConfirmGameGrades(world).execute({
        actor: colleagueOf(s.actor),
        gameId: s.game.id,
      }),
    ).toEqual(forbidden);
  });
});
