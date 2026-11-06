import {
  err,
  ok,
  leadScores,
  type ChatSession,
  type ChatSessionId,
  type ChatTurn,
  type ChatTurnId,
  type Lead,
  type LeadId,
  type LeadScore,
  type Result,
} from '@thp/domain';
import type {
  ChatbotRequest,
  ChatbotWriter,
  ChatSessionRepository,
  ChatTurnQueue,
  DraftError,
  LeadQuery,
  LeadRepository,
} from '@thp/ports';

export class InMemoryLeadRepository implements LeadRepository {
  private readonly rows = new Map<LeadId, Lead>();

  save(lead: Lead): Promise<void> {
    this.rows.set(lead.id, lead);
    return Promise.resolve();
  }

  findById(id: LeadId): Promise<Lead | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  search(query: LeadQuery): Promise<readonly Lead[]> {
    const text = query.text?.trim().toLowerCase() ?? '';
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (l) =>
            text === '' ||
            [l.name, l.email, l.organization ?? ''].some((v) => v.toLowerCase().includes(text)),
        )
        .filter((l) => query.score === undefined || l.score === query.score)
        .filter((l) => query.source === undefined || l.source === query.source)
        .filter((l) => query.status === undefined || l.status === query.status)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit),
    );
  }

  countByScore(): Promise<Readonly<Record<LeadScore, number>>> {
    const rows = [...this.rows.values()];
    return Promise.resolve(
      Object.fromEntries(
        leadScores.map((score) => [score, rows.filter((l) => l.score === score).length]),
      ) as Record<LeadScore, number>,
    );
  }
}

/** Chat sessions and their turns, kept together so deleting a chat deletes its turns. */
export class InMemoryChat implements ChatSessionRepository, ChatTurnQueue {
  private readonly sessions = new Map<ChatSessionId, ChatSession>();
  private readonly turns = new Map<ChatTurnId, ChatTurn & { claimed: boolean }>();

  save(session: ChatSession): Promise<void> {
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<ChatSession | null> {
    return Promise.resolve(
      [...this.sessions.values()].find((s) => s.tokenHash === tokenHash) ?? null,
    );
  }

  findById(id: ChatSessionId): Promise<ChatSession | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  countVisitorMessagesSince(visitorHash: string, since: Date): Promise<number> {
    const mine = new Set(
      [...this.sessions.values()].filter((s) => s.visitorHash === visitorHash).map((s) => s.id),
    );
    return Promise.resolve(
      [...this.turns.values()].filter(
        (t) => mine.has(t.sessionId) && t.createdAt.getTime() >= since.getTime(),
      ).length,
    );
  }

  deleteStartedBefore(cutoff: Date): Promise<number> {
    const old = [...this.sessions.values()].filter((s) => s.createdAt < cutoff);
    for (const session of old) {
      this.sessions.delete(session.id);
      for (const turn of this.turns.values()) {
        if (turn.sessionId === session.id) this.turns.delete(turn.id);
      }
    }
    return Promise.resolve(old.length);
  }

  enqueue(turn: ChatTurn): Promise<void> {
    this.turns.set(turn.id, { ...turn, claimed: false });
    return Promise.resolve();
  }

  claimNext(): Promise<ChatTurn | null> {
    const next = [...this.turns.values()]
      .filter((t) => t.status === 'pending' && !t.claimed)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (next === undefined) return Promise.resolve(null);
    this.turns.set(next.id, { ...next, claimed: true });
    return Promise.resolve(this.plain(next));
  }

  answer(id: ChatTurnId, reply: string): Promise<void> {
    const turn = this.turns.get(id);
    if (turn !== undefined) this.turns.set(id, { ...turn, reply, status: 'answered' });
    return Promise.resolve();
  }

  fail(id: ChatTurnId): Promise<void> {
    const turn = this.turns.get(id);
    if (turn !== undefined) this.turns.set(id, { ...turn, status: 'failed' });
    return Promise.resolve();
  }

  listForSession(sessionId: ChatSessionId): Promise<readonly ChatTurn[]> {
    return Promise.resolve(
      [...this.turns.values()]
        .filter((t) => t.sessionId === sessionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((t) => this.plain(t)),
    );
  }

  private plain(turn: ChatTurn & { claimed: boolean }): ChatTurn {
    return {
      id: turn.id,
      sessionId: turn.sessionId,
      message: turn.message,
      reply: turn.reply,
      status: turn.status,
      createdAt: turn.createdAt,
    };
  }
}

/** Replies with a fixed answer (or fails) and records what it was sent. */
export class FakeChatbotWriter implements ChatbotWriter {
  readonly requests: ChatbotRequest[] = [];

  constructor(private readonly outcome: Result<string, DraftError> = ok('Happy to help!')) {}

  reply(request: ChatbotRequest): Promise<Result<string, DraftError>> {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

/** A writer that is down, for failure tests. */
export const unavailableChatbot = () => new FakeChatbotWriter(err({ code: 'ai_unavailable' }));
