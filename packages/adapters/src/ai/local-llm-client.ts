import { ok, type Result } from '@thp/domain';
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from '@thp/ports';

/**
 * A stand-in for Claude in local runs and E2E tests: replies with whatever the injected function
 * writes for the request. It never calls the network and never fails.
 */
export class LocalLlmClient implements LlmClient {
  constructor(private readonly reply: (request: LlmRequest) => string) {}

  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    return Promise.resolve(ok({ text: this.reply(request), stopReason: 'end' }));
  }
}
