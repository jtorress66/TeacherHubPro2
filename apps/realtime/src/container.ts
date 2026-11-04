import { defaultGameModes } from '@thp/domain';
import {
  createDatabase,
  createPostgresRepositories,
  HmacTicketSigner,
  SystemClock,
} from '@thp/adapters';
import { createLiveCommands } from './commands.ts';
import type { RealtimeConfig } from './config.ts';
import { LiveHub } from './live-hub.ts';
import { createRealtimeServer, timerScheduler } from './server.ts';

// Composition root: the only place in the realtime app where concrete adapters are created.

export function createRealtime(config: RealtimeConfig) {
  const db = createDatabase(config.databaseUrl);
  const commands = createLiveCommands({
    ...createPostgresRepositories(db),
    ticketSigner: new HmacTicketSigner(config.ticketSecret),
    clock: new SystemClock(),
    gameModes: defaultGameModes,
  });
  const server = createRealtimeServer(new LiveHub(commands, timerScheduler), {
    allowedOrigin: config.allowedOrigin,
  });
  return { server, close: () => db.destroy() };
}
