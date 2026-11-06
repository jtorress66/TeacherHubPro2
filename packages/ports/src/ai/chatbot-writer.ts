import type { ChatFacts, Language, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** One earlier message in the chat. */
export interface ChatLine {
  readonly from: 'visitor' | 'assistant';
  readonly text: string;
}

/** What the chatbot may know: the product facts and the visitor's own words, never their contact details. */
export interface ChatbotRequest {
  readonly facts: ChatFacts;
  readonly language: Language;
  readonly role: string;
  readonly interest: string;
  /** Oldest first, at most the last few exchanges. */
  readonly history: readonly ChatLine[];
  readonly message: string;
}

/** Answers a website visitor as TeacherHubPro's AI assistant. */
export interface ChatbotWriter {
  reply(request: ChatbotRequest): Promise<Result<string, DraftError>>;
}
