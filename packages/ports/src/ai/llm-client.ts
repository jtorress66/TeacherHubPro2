import type { Result } from '@thp/domain';

export interface LlmMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface LlmRequest {
  readonly system: string;
  readonly messages: readonly LlmMessage[];
  readonly maxTokens: number;
}

export interface LlmResponse {
  readonly text: string;
  readonly stopReason: 'end' | 'max_tokens';
}

export interface LlmError {
  readonly code: 'rate_limited' | 'unavailable' | 'invalid_request' | 'refused';
}

/** A text-in, text-out language model. Callers send only the fields a task needs. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>>;
}
