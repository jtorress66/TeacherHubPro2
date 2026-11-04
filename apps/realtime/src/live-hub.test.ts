import { describe, expect, it } from 'vitest';
import { hostTicket, playerTicket, type LiveView } from '@thp/application';
import {
  defaultGameModes,
  isCorrectLiveAnswer,
  type ClassId,
  type LivePlayerId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import {
  aGame,
  aLivePlayer,
  aLiveSession,
  FakeTicketSigner,
  FixedClock,
  InMemoryGamePlayRepository,
  InMemoryGameRepository,
  InMemoryLiveAnswerRepository,
  InMemoryLivePlayerRepository,
  InMemoryLiveSessionRepository,
} from '@thp/testing';
import { createLiveCommands } from './commands.ts';
import { LiveHub, type Connection, type Scheduler } from './live-hub.ts';
import type { ServerMessage } from './messages.ts';

class FakeScheduler implements Scheduler {
  readonly tasks: { ms: number; run: () => void; cancelled: boolean }[] = [];

  schedule(ms: number, run: () => void): () => void {
    const task = { ms, run, cancelled: false };
    this.tasks.push(task);
    return () => {
      task.cancelled = true;
    };
  }

  /** Runs the newest task that is still due. */
  runLast(): void {
    const task = this.tasks.filter((t) => !t.cancelled).at(-1);
    task?.run();
  }
}

class FakeConnection implements Connection {
  readonly sent: ServerMessage[] = [];
  closed = false;

  send(message: ServerMessage): void {
    this.sent.push(message);
  }

  close(): void {
    this.closed = true;
  }

  lastView(): LiveView | undefined {
    const views = this.sent.flatMap((m) => (m.type === 'view' ? [m.view] : []));
    return views.at(-1);
  }

  lastError(): string | undefined {
    const errors = this.sent.flatMap((m) => (m.type === 'error' ? [m.code] : []));
    return errors.at(-1);
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setUp() {
  const clock = new FixedClock(new Date('2026-11-04T10:00:00Z'));
  const deps = {
    clock,
    gameModes: defaultGameModes,
    games: new InMemoryGameRepository(),
    gamePlays: new InMemoryGamePlayRepository(),
    liveSessions: new InMemoryLiveSessionRepository(),
    livePlayers: new InMemoryLivePlayerRepository(),
    liveAnswers: new InMemoryLiveAnswerRepository(),
    ticketSigner: new FakeTicketSigner(),
  };
  const game = aGame({ classId: 'class-1' as ClassId });
  const session = aLiveSession({ gameId: game.id, createdAt: clock.now() });
  await deps.games.save(game);
  await deps.liveSessions.save(session);
  const ana = aLivePlayer({ id: 'p-ana' as LivePlayerId, studentId: 's-ana' as StudentId });
  const ben = aLivePlayer({
    id: 'p-ben' as LivePlayerId,
    studentId: 's-ben' as StudentId,
    firstName: 'Ben',
  });
  await deps.livePlayers.save(ana);
  await deps.livePlayers.save(ben);
  const scheduler = new FakeScheduler();
  const hub = new LiveHub(createLiveCommands(deps), scheduler);
  const connect = async (ticket: string) => {
    const connection = new FakeConnection();
    await hub.receive(connection, JSON.stringify({ type: 'hello', ticket }));
    return connection;
  };
  const host = await connect(
    hostTicket(deps.ticketSigner, session, 'teacher-1' as UserId, clock.now()),
  );
  const anaScreen = await connect(playerTicket(deps.ticketSigner, ana, clock.now()));
  const benScreen = await connect(playerTicket(deps.ticketSigner, ben, clock.now()));
  const right = (question: number) =>
    [0, 1, 2, 3].find((c) =>
      isCorrectLiveAnswer(game, session.mode, session.seed, question, c, defaultGameModes),
    ) ?? 0;
  const send = (connection: Connection, message: object) =>
    hub.receive(connection, JSON.stringify(message));
  return { deps, clock, hub, scheduler, session, host, anaScreen, benScreen, right, send };
}

describe('LiveHub', () => {
  it('a connection says hello with its ticket and gets its own view', async () => {
    const s = await setUp();
    expect(s.host.lastView()).toMatchObject({ status: 'lobby', pin: s.session.pin });
    expect(s.anaScreen.lastView()).toMatchObject({ status: 'lobby', pin: null });
    expect(s.anaScreen.lastView()?.you).toMatchObject({ firstName: 'Ana' });
  });

  it('turns away a bad ticket, and anything before hello', async () => {
    const s = await setUp();
    const stranger = new FakeConnection();
    await s.send(stranger, { type: 'start' });
    expect(stranger.lastError()).toBe('unauthenticated');
    expect(stranger.closed).toBe(true);

    const forger = new FakeConnection();
    await s.send(forger, { type: 'hello', ticket: 'made.up.ticket' });
    expect(forger.lastError()).toBe('unauthenticated');
    expect(forger.closed).toBe(true);
  });

  it('after a change, every screen in the session gets its new view', async () => {
    const s = await setUp();
    await s.send(s.host, { type: 'start' });
    expect(s.host.lastView()?.status).toBe('question');
    expect(s.anaScreen.lastView()).toMatchObject({ status: 'question', current: 0 });
    expect(s.anaScreen.lastView()?.reveal).toBeNull();

    await s.send(s.anaScreen, { type: 'answer', question: 0, choice: s.right(0) });
    expect(s.host.lastView()?.answered).toBe(1);
    await s.send(s.benScreen, { type: 'answer', question: 0, choice: s.right(0) });
    expect(s.anaScreen.lastView()).toMatchObject({ status: 'reveal', you: { correct: 1 } });
    expect(s.anaScreen.lastView()?.reveal?.correctChoice).toBe(s.right(0));
  });

  it('reveals the answer when time is up, and a timer from an old question does nothing', async () => {
    const s = await setUp();
    await s.send(s.host, { type: 'start' });
    expect(s.scheduler.tasks.at(-1)?.ms).toBeGreaterThanOrEqual(20_000);
    s.clock.advanceBy(20_500);
    s.scheduler.runLast();
    await settle();
    expect(s.host.lastView()?.status).toBe('reveal');

    await s.send(s.host, { type: 'next' });
    expect(s.host.lastView()).toMatchObject({ status: 'question', current: 1 });
    s.scheduler.tasks[0]?.run();
    await settle();
    expect(s.host.lastView()).toMatchObject({ status: 'question', current: 1 });
  });

  it('a player cannot run the game, and a malformed message is refused', async () => {
    const s = await setUp();
    await s.send(s.anaScreen, { type: 'start' });
    expect(s.anaScreen.lastError()).toBe('forbidden');
    await s.hub.receive(s.anaScreen, 'not json');
    expect(s.anaScreen.lastError()).toBe('invalid_message');
    await s.send(s.anaScreen, { type: 'answer', question: -1, choice: 0 });
    expect(s.anaScreen.lastError()).toBe('invalid_message');
    expect(s.host.lastView()?.status).toBe('lobby');
  });

  it('removing a player updates the host, and a closed connection gets nothing more', async () => {
    const s = await setUp();
    s.hub.disconnect(s.benScreen);
    const before = s.benScreen.sent.length;
    await s.send(s.host, { type: 'remove', playerId: 'p-ana' });
    expect(s.host.lastView()?.players.map((p) => p.firstName)).toEqual(['Ben']);
    expect(s.benScreen.sent).toHaveLength(before);
  });

  it('ending the session cancels its timer', async () => {
    const s = await setUp();
    await s.send(s.host, { type: 'start' });
    await s.send(s.host, { type: 'end' });
    expect(s.host.lastView()?.status).toBe('ended');
    expect(s.scheduler.tasks.every((t) => t.cancelled)).toBe(true);
  });
});
