import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { hostTicket } from '@thp/application';
import { defaultGameModes, type UserId } from '@thp/domain';
import {
  aGame,
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
import { LiveHub } from './live-hub.ts';
import type { ServerMessage } from './messages.ts';
import { createRealtimeServer, timerScheduler } from './server.ts';

const origin = 'https://app.teacherhub.test';
const servers: { close: () => void }[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function start() {
  const clock = new FixedClock(new Date('2026-11-04T10:00:00Z'));
  const signer = new FakeTicketSigner();
  const deps = {
    clock,
    gameModes: defaultGameModes,
    games: new InMemoryGameRepository(),
    gamePlays: new InMemoryGamePlayRepository(),
    liveSessions: new InMemoryLiveSessionRepository(),
    livePlayers: new InMemoryLivePlayerRepository(),
    liveAnswers: new InMemoryLiveAnswerRepository(),
    ticketSigner: signer,
  };
  const game = aGame();
  const session = aLiveSession({ gameId: game.id });
  await deps.games.save(game);
  await deps.liveSessions.save(session);
  const hub = new LiveHub(createLiveCommands(deps), timerScheduler);
  const server = createRealtimeServer(hub, { allowedOrigin: origin });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  servers.push(server);
  const port = (server.address() as AddressInfo).port;
  const ticket = hostTicket(signer, session, 'teacher-1' as UserId, clock.now());
  return { port, ticket, session };
}

/** Opens a socket, sends hello, and resolves with the first message back. */
function firstMessage(port: number, ticket: string, from = origin): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/live`, { origin: from });
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', ticket }));
    });
    socket.on('message', (data: Buffer) => {
      resolve(JSON.parse(data.toString()) as ServerMessage);
      socket.close();
    });
    socket.on('error', reject);
  });
}

describe('the realtime server', () => {
  it('answers its health check', async () => {
    const { port } = await start();
    const response = await fetch(`http://127.0.0.1:${String(port)}/health`);
    expect(response.status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${String(port)}/other`)).status).toBe(404);
  });

  it('sends the host’s view after a hello with a genuine ticket', async () => {
    const { port, ticket, session } = await start();
    const message = await firstMessage(port, ticket);
    expect(message).toMatchObject({ type: 'view', view: { status: 'lobby', pin: session.pin } });
  });

  it('turns away a forged ticket', async () => {
    const { port } = await start();
    expect(await firstMessage(port, 'forged.ticket.value')).toEqual({
      type: 'error',
      code: 'unauthenticated',
    });
  });

  it('refuses connections from other sites', async () => {
    const { port, ticket } = await start();
    await expect(firstMessage(port, ticket, 'https://evil.example')).rejects.toThrow();
  });
});
