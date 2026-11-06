import {
  canSendChatMessage,
  chatFacts,
  chatRetentionDays,
  checkChatMessage,
  isLanguage,
  ok,
  startChatSession,
  type ChatSessionId,
  type ChatTurn,
  type ChatTurnId,
  type Result,
} from '@thp/domain';
import type {
  ChatbotWriter,
  ChatLine,
  ChatSessionRepository,
  ChatTurnQueue,
  Clock,
  IdGenerator,
  RandomTokenGenerator,
  TokenHasher,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

const hourMs = 60 * 60 * 1000;
/** Earlier exchanges sent to the AI as context. */
const contextTurns = 5;

interface ChatDeps {
  readonly chatSessions: ChatSessionRepository;
  readonly chatTurns: ChatTurnQueue;
  readonly tokenHasher: TokenHasher;
  readonly clock: Clock;
}

/** The visitor's address is kept only as a hash, for the hourly limit. */
const visitorHash = (hasher: TokenHasher, visitor: string) => hasher.hash(`visitor:${visitor}`);

/**
 * Opens a chat with the website assistant. The visitor gets a secret token; only its hash is
 * stored, so no one else can read the chat.
 */
export class StartChat {
  constructor(
    private readonly deps: ChatDeps & {
      readonly tokens: RandomTokenGenerator;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    role: string;
    interest: string;
    locale: string;
    page: string | null;
    visitor: string;
  }): Promise<Result<{ readonly token: string }, UseCaseError>> {
    const token = this.deps.tokens.generate();
    await this.deps.chatSessions.save(
      startChatSession({
        id: this.deps.ids.next() as ChatSessionId,
        tokenHash: await this.deps.tokenHasher.hash(token),
        visitorHash: await visitorHash(this.deps.tokenHasher, input.visitor),
        role: input.role.slice(0, 40),
        interest: input.interest.slice(0, 40),
        locale: isLanguage(input.locale) ? input.locale : 'en',
        page: input.page?.slice(0, 300) ?? null,
        now: this.deps.clock.now(),
      }),
    );
    return ok({ token });
  }
}

async function sessionOf(deps: ChatDeps, token: string) {
  return token.trim() === ''
    ? null
    : deps.chatSessions.findByTokenHash(await deps.tokenHasher.hash(token));
}

/** Queues a visitor's message for the worker, within the chat's and the visitor's limits. */
export class SendChatMessage {
  constructor(private readonly deps: ChatDeps & { readonly ids: IdGenerator }) {}

  async execute(input: {
    token: string;
    message: string;
    visitor: string;
  }): Promise<Result<{ readonly turnId: ChatTurnId }, UseCaseError>> {
    const session = await sessionOf(this.deps, input.token);
    if (session === null) return fail('not_found');
    const message = checkChatMessage(input.message);
    if (!message.ok) return message;
    const now = this.deps.clock.now();
    const recent = await this.deps.chatSessions.countVisitorMessagesSince(
      session.visitorHash,
      new Date(now.getTime() - hourMs),
    );
    if (!canSendChatMessage({ sessionTurns: session.turns, visitorMessagesLastHour: recent })) {
      return fail('rate_limited');
    }
    const turn: ChatTurn = {
      id: this.deps.ids.next() as ChatTurnId,
      sessionId: session.id,
      message: message.value,
      reply: null,
      status: 'pending',
      createdAt: now,
    };
    await this.deps.chatTurns.enqueue(turn);
    await this.deps.chatSessions.save({ ...session, turns: session.turns + 1 });
    return ok({ turnId: turn.id });
  }
}

/** The visitor's own chat, for the widget to show replies as they arrive. */
export class GetChat {
  constructor(private readonly deps: ChatDeps) {}

  async execute(input: { token: string }): Promise<Result<readonly ChatTurn[], UseCaseError>> {
    const session = await sessionOf(this.deps, input.token);
    if (session === null) return fail('not_found');
    return ok(await this.deps.chatTurns.listForSession(session.id));
  }
}

export type ChatRun = 'idle' | 'answered' | 'failed';

/** The worker answers the oldest waiting message with the chatbot, given the chat so far. */
export class RunNextChatTurn {
  constructor(
    private readonly deps: Omit<ChatDeps, 'tokenHasher' | 'clock'> & {
      readonly chatbot: ChatbotWriter;
    },
  ) {}

  async execute(): Promise<ChatRun> {
    const turn = await this.deps.chatTurns.claimNext();
    if (turn === null) return 'idle';
    const session = await this.deps.chatSessions.findById(turn.sessionId);
    if (session === null) {
      await this.deps.chatTurns.fail(turn.id);
      return 'failed';
    }
    const earlier = (await this.deps.chatTurns.listForSession(session.id))
      .filter((t) => t.status === 'answered' && t.id !== turn.id)
      .slice(-contextTurns);
    const history: ChatLine[] = earlier.flatMap((t) => [
      { from: 'visitor' as const, text: t.message },
      { from: 'assistant' as const, text: t.reply ?? '' },
    ]);
    const reply = await this.deps.chatbot.reply({
      facts: chatFacts(),
      language: isLanguage(session.locale) ? session.locale : 'en',
      role: session.role,
      interest: session.interest,
      history,
      message: turn.message,
    });
    if (!reply.ok) {
      await this.deps.chatTurns.fail(turn.id);
      return 'failed';
    }
    await this.deps.chatTurns.answer(turn.id, reply.value);
    return 'answered';
  }
}

/** Chats are deleted after 30 days. */
export class SweepOldChats {
  constructor(
    private readonly deps: { readonly chatSessions: ChatSessionRepository; readonly clock: Clock },
  ) {}

  execute(): Promise<number> {
    const cutoff = new Date(this.deps.clock.now().getTime() - chatRetentionDays * 24 * hourMs);
    return this.deps.chatSessions.deleteStartedBefore(cutoff);
  }
}
