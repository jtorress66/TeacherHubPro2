import type { ChatSessionId, ChatTurnId } from '../shared/ids.ts';
import type { Result } from '../shared/result.ts';
import { requiredText, type ValidationError } from '../shared/validation.ts';

/** Keeps the free chatbot from being used as a free AI. */
export const chatLimits = { turnsPerSession: 20, messagesPerHour: 60 } as const;
export const maxChatMessageLength = 1000;
/** Chats are kept this long, then deleted. */
export const chatRetentionDays = 30;

/**
 * A visitor's chat with the marketing chatbot. The visitor holds a secret token; only its hash
 * is kept. The visitor's IP is kept only as a hash, for the hourly limit.
 */
export interface ChatSession {
  readonly id: ChatSessionId;
  readonly tokenHash: string;
  readonly visitorHash: string;
  readonly role: string;
  readonly interest: string;
  readonly locale: string;
  readonly page: string | null;
  readonly turns: number;
  readonly createdAt: Date;
}

export type ChatTurnStatus = 'pending' | 'answered' | 'failed';

/** One visitor message and the AI's reply, answered by the worker. */
export interface ChatTurn {
  readonly id: ChatTurnId;
  readonly sessionId: ChatSessionId;
  readonly message: string;
  readonly reply: string | null;
  readonly status: ChatTurnStatus;
  readonly createdAt: Date;
}

export const startChatSession = (input: {
  readonly id: ChatSessionId;
  readonly tokenHash: string;
  readonly visitorHash: string;
  readonly role: string;
  readonly interest: string;
  readonly locale: string;
  readonly page: string | null;
  readonly now: Date;
}): ChatSession => ({
  id: input.id,
  tokenHash: input.tokenHash,
  visitorHash: input.visitorHash,
  role: input.role,
  interest: input.interest,
  locale: input.locale,
  page: input.page,
  turns: 0,
  createdAt: input.now,
});

export const checkChatMessage = (message: string): Result<string, ValidationError> =>
  requiredText('message', message, maxChatMessageLength);

export const canSendChatMessage = (usage: {
  readonly sessionTurns: number;
  readonly visitorMessagesLastHour: number;
}): boolean =>
  usage.sessionTurns < chatLimits.turnsPerSession &&
  usage.visitorMessagesLastHour < chatLimits.messagesPerHour;
