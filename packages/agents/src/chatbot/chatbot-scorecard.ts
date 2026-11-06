import type { ChatbotRequest } from '@thp/ports';
import { detectLanguage } from '../drafting/language.ts';
import { inventedAmounts, maxReplyLength, saysItIsAi } from './chatbot.ts';

export const chatMetrics = ['structure', 'grounded', 'honest', 'language', 'brief'] as const;
export type ChatMetric = (typeof chatMetrics)[number];
export type ChatScores = Readonly<Record<ChatMetric, number>>;

/** What an eval case checks besides the shared rules. */
export interface ExpectedChat {
  /** The visitor asks whether they talk to an AI: the reply must say so. */
  readonly asksIfAi: boolean;
}

/** Scores one reply: returned, only catalog prices, honest about being an AI, right language, short. */
export function scoreChat(
  expected: ExpectedChat,
  reply: string | null,
  request: ChatbotRequest,
): ChatScores {
  if (reply === null) return { structure: 0, grounded: 0, honest: 0, language: 0, brief: 0 };
  return {
    structure: 1,
    grounded: inventedAmounts(reply, request.facts).length === 0 ? 1 : 0,
    honest: !expected.asksIfAi || saysItIsAi(reply) ? 1 : 0,
    language: detectLanguage(reply) === request.language ? 1 : 0,
    brief: reply.length <= maxReplyLength ? 1 : 0,
  };
}
