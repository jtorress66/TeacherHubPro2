import type { LiveActor, LiveView, UseCaseError } from '@thp/application';
import type { LivePlayerId, Result } from '@thp/domain';
import type { LiveCommands } from './commands.ts';
import { readMessage, type CommandMessage, type ServerMessage } from './messages.ts';

/** One browser connection, whatever carries it. */
export interface Connection {
  send(message: ServerMessage): void;
  close(): void;
}

/** Runs a task later; the returned function cancels it. */
export interface Scheduler {
  schedule(ms: number, run: () => void): () => void;
}

/** A little after the question's time is up, so a last-moment answer still counts. */
const revealGraceMs = 300;

type Handler<K extends CommandMessage['type']> = (
  commands: LiveCommands,
  actor: LiveActor,
  message: Extract<CommandMessage, { type: K }>,
) => Promise<Result<unknown, UseCaseError>>;

/** What each message does. A new message type is a new entry. */
const handlers: { readonly [K in CommandMessage['type']]: Handler<K> } = {
  start: (c, actor) => c.start.execute({ actor }),
  next: (c, actor) => c.next.execute({ actor }),
  reveal: (c, actor) => c.reveal.execute({ actor }),
  end: (c, actor) => c.end.execute({ actor }),
  remove: (c, actor, m) => c.remove.execute({ actor, playerId: m.playerId as LivePlayerId }),
  answer: (c, actor, m) => c.answer.execute({ actor, question: m.question, choice: m.choice }),
};

const roomOf = (actor: LiveActor): string => `${actor.schoolId}:${actor.sessionId}`;

/**
 * The realtime core: connections join their session's room with a ticket, messages run the use
 * cases, and every change sends each screen its own view. Free of any network library.
 */
export class LiveHub {
  private readonly actors = new Map<Connection, LiveActor>();
  private readonly rooms = new Map<string, Set<Connection>>();
  private readonly timers = new Map<string, () => void>();

  constructor(
    private readonly commands: LiveCommands,
    private readonly scheduler: Scheduler,
  ) {}

  async receive(connection: Connection, raw: string): Promise<void> {
    const message = readMessage(raw);
    const actor = this.actors.get(connection);
    if (actor === undefined) {
      await this.hello(connection, message?.type === 'hello' ? message.ticket : null);
      return;
    }
    if (message === null || message.type === 'hello') {
      connection.send({ type: 'error', code: 'invalid_message' });
      return;
    }
    const handle = handlers[message.type] as Handler<typeof message.type>;
    const result = await handle(this.commands, actor, message);
    if (!result.ok) {
      connection.send({
        type: 'error',
        code: result.error.code,
        ...('field' in result.error ? { field: result.error.field } : {}),
      });
      return;
    }
    await this.changed(actor);
  }

  disconnect(connection: Connection): void {
    const actor = this.actors.get(connection);
    if (actor === undefined) return;
    this.actors.delete(connection);
    this.rooms.get(roomOf(actor))?.delete(connection);
  }

  private async hello(connection: Connection, ticket: string | null): Promise<void> {
    const actor = ticket === null ? null : await this.commands.verify.execute({ ticket });
    if (!actor?.ok) {
      connection.send({ type: 'error', code: 'unauthenticated' });
      connection.close();
      return;
    }
    this.actors.set(connection, actor.value);
    const room = this.rooms.get(roomOf(actor.value)) ?? new Set<Connection>();
    room.add(connection);
    this.rooms.set(roomOf(actor.value), room);
    await this.sendView(connection, actor.value);
  }

  /** Sends every screen in the session its view, and sets the timer for the question shown. */
  private async changed(actor: LiveActor): Promise<void> {
    const room = this.rooms.get(roomOf(actor)) ?? new Set<Connection>();
    for (const connection of room) {
      const owner = this.actors.get(connection);
      if (owner !== undefined) await this.sendView(connection, owner);
    }
    const system: LiveActor = {
      role: 'system',
      schoolId: actor.schoolId,
      sessionId: actor.sessionId,
    };
    const view = await this.commands.view.execute({ actor: system });
    if (view.ok) this.setTimer(system, view.value);
  }

  private async sendView(connection: Connection, actor: LiveActor): Promise<void> {
    const view = await this.commands.view.execute({ actor });
    if (view.ok) connection.send({ type: 'view', view: view.value });
  }

  /** One timer per session: the reveal of the question on screen, if any. */
  private setTimer(system: LiveActor, view: LiveView): void {
    const key = roomOf(system);
    this.timers.get(key)?.();
    this.timers.delete(key);
    if (view.status !== 'question') return;
    const question = view.current;
    const cancel = this.scheduler.schedule(view.timeLeftMs + revealGraceMs, () => {
      this.timers.delete(key);
      void this.commands.reveal
        .execute({ actor: system, question })
        .then((result) => (result.ok ? this.changed(system) : undefined));
    });
    this.timers.set(key, cancel);
  }
}
