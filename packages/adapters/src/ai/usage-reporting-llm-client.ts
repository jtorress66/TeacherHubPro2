import type { Result } from '@thp/domain';
import type { LlmClient, LlmError, LlmRequest, LlmResponse, LlmUsage } from '@thp/ports';

/** Token counts as one line: numbers only, never prompt or reply text. */
export function formatUsage(usage: LlmUsage): string {
  const input = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const fromCache = input === 0 ? 0 : Math.round((usage.cacheReadTokens / input) * 100);
  return (
    `LLM usage: input ${String(usage.inputTokens)}, cache read ${String(usage.cacheReadTokens)}, ` +
    `cache write ${String(usage.cacheWriteTokens)}, output ${String(usage.outputTokens)} ` +
    `(${String(fromCache)}% of input from cache)`
  );
}

/** Wraps a model and reports each reply's token usage, so cache hit rates can be watched. */
export class UsageReportingLlmClient implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly report: (usage: LlmUsage) => void,
  ) {}

  async complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    const reply = await this.inner.complete(request);
    if (reply.ok && reply.value.usage !== undefined) this.report(reply.value.usage);
    return reply;
  }
}
