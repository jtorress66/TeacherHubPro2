import Anthropic from '@anthropic-ai/sdk';
import { err, ok, type Result } from '@thp/domain';
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from '@thp/ports';

export const defaultClaudeModel = 'claude-sonnet-5-5';

export interface AnthropicConfig {
  readonly apiKey: string;
  readonly model?: string;
  /** How long to wait for the reply to start; once it streams, it is never cut off. */
  readonly timeoutMs?: number;
  /** The SDK retries rate limits, overloads and server errors this many times. */
  readonly maxRetries?: number;
  readonly baseURL?: string;
}

/** 4xx other than timeouts, conflicts and rate limits cannot succeed on retry. */
function errorCode(error: unknown): LlmError['code'] {
  if (error instanceof Anthropic.RateLimitError) return 'rate_limited';
  const status: unknown = error instanceof Anthropic.APIError ? error.status : undefined;
  const retryable = typeof status !== 'number' || status >= 500 || [408, 409].includes(status);
  return retryable ? 'unavailable' : 'invalid_request';
}

/**
 * Claude through the official SDK. A refusal is offered to Claude's server-side fallback model
 * first, and reported as `refused` only if the whole chain declines. Nothing is logged.
 *
 * Replies are streamed: the SDK's timeout covers only the wait for the reply to start, so a long
 * draft is never cut off and sent again (each resend is paid for). Rate limits and server errors
 * before the reply starts are still retried.
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeoutMs ?? 120_000,
      maxRetries: config.maxRetries ?? 2,
      ...(config.baseURL === undefined ? {} : { baseURL: config.baseURL }),
    });
    this.model = config.model ?? defaultClaudeModel;
  }

  async complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    try {
      const response = await this.client.beta.messages
        .stream({
          model: this.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages.map(({ role, content }) => ({ role, content })),
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
        .finalMessage();
      if (response.stop_reason === 'refusal') return err({ code: 'refused' });
      const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : []));
      return ok({
        text: text.join(''),
        stopReason: response.stop_reason === 'max_tokens' ? 'max_tokens' : 'end',
      });
    } catch (error) {
      return err({ code: errorCode(error) });
    }
  }
}
