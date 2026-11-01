import type { Result } from '@thp/domain';

export interface LlmMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  /**
   * A leading part of `content` that repeats unchanged across requests (shared instructions, a
   * test's questions and rubrics). A client may cache it; `content` must start with it.
   */
  readonly stablePrefix?: string;
}

export interface LlmRequest {
  /** The same text on every request for a task: never per-request data. */
  readonly system: string;
  readonly messages: readonly LlmMessage[];
  readonly maxTokens: number;
}

/** Tokens a request used; cache reads and writes are billed differently from plain input. */
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
}

export interface LlmResponse {
  readonly text: string;
  readonly stopReason: 'end' | 'max_tokens';
  /** Reported by clients that know it. */
  readonly usage?: LlmUsage;
}

export interface LlmError {
  readonly code: 'rate_limited' | 'unavailable' | 'invalid_request' | 'refused';
}

/** A text-in, text-out language model. Callers send only the fields a task needs. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>>;
}
