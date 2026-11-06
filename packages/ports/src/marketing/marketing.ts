import type {
  ChatSession,
  ChatSessionId,
  ChatTurn,
  ChatTurnId,
  Lead,
  LeadId,
  LeadScore,
  LeadSource,
  LeadStatus,
} from '@thp/domain';

export interface LeadQuery {
  /** Part of a name, email or organization, any case. */
  readonly text?: string;
  readonly score?: LeadScore;
  readonly source?: LeadSource;
  readonly status?: LeadStatus;
  readonly limit: number;
}

/** Leads from the chatbot and contact form; read only by super admins (the use cases check). */
export interface LeadRepository {
  save(lead: Lead): Promise<void>;
  findById(id: LeadId): Promise<Lead | null>;
  /** Newest first. */
  search(query: LeadQuery): Promise<readonly Lead[]>;
  countByScore(): Promise<Readonly<Record<LeadScore, number>>>;
}

export interface ChatSessionRepository {
  save(session: ChatSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<ChatSession | null>;
  findById(id: ChatSessionId): Promise<ChatSession | null>;
  /** Messages sent by a visitor (hashed IP) since a time, across their sessions. */
  countVisitorMessagesSince(visitorHash: string, since: Date): Promise<number>;
  /** Deletes chats started before the cut-off, with their turns; returns how many. */
  deleteStartedBefore(cutoff: Date): Promise<number>;
}

/** Visitors' messages waiting for the chatbot's reply, answered one at a time by the worker. */
export interface ChatTurnQueue {
  enqueue(turn: ChatTurn): Promise<void>;
  /** Atomically takes the oldest pending turn (marks it taken so no other worker answers it). */
  claimNext(): Promise<ChatTurn | null>;
  answer(id: ChatTurnId, reply: string): Promise<void>;
  fail(id: ChatTurnId): Promise<void>;
  /** The session's turns, oldest first. */
  listForSession(sessionId: ChatSessionId): Promise<readonly ChatTurn[]>;
}
