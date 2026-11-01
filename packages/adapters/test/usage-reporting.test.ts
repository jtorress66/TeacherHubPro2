import { describe, expect, it } from 'vitest';
import { err, ok } from '@thp/domain';
import type { LlmClient, LlmUsage } from '@thp/ports';
import { FakeLlmClient, llmClientContract } from '@thp/testing';
import { formatUsage, UsageReportingLlmClient } from '../src/ai/usage-reporting-llm-client.ts';

const usage: LlmUsage = {
  inputTokens: 40,
  outputTokens: 120,
  cacheReadTokens: 900,
  cacheWriteTokens: 0,
};
const request = {
  system: 'S',
  messages: [{ role: 'user' as const, content: 'Hi' }],
  maxTokens: 10,
};

llmClientContract('UsageReportingLlmClient', {
  replying: (text) =>
    new UsageReportingLlmClient(new FakeLlmClient().replyWith(text), () => undefined),
  failing: (code) =>
    new UsageReportingLlmClient(new FakeLlmClient().failWith(code), () => undefined),
});

describe('UsageReportingLlmClient', () => {
  it('passes the reply through and reports its token counts, nothing else', async () => {
    const inner: LlmClient = {
      complete: () => Promise.resolve(ok({ text: 'secret answer', stopReason: 'end', usage })),
    };
    const reports: LlmUsage[] = [];
    const client = new UsageReportingLlmClient(inner, (reported) => reports.push(reported));

    expect(await client.complete(request)).toEqual(
      ok({ text: 'secret answer', stopReason: 'end', usage }),
    );
    expect(reports).toEqual([usage]);
  });

  it('reports nothing for a failure or a reply without usage', async () => {
    const reports: LlmUsage[] = [];
    const report = (reported: LlmUsage) => reports.push(reported);
    await new UsageReportingLlmClient(new FakeLlmClient().replyWith('ok'), report).complete(
      request,
    );
    const failing: LlmClient = { complete: () => Promise.resolve(err({ code: 'unavailable' })) };
    await new UsageReportingLlmClient(failing, report).complete(request);
    expect(reports).toEqual([]);
  });

  it('formats usage as one line of numbers, with the share of input read from the cache', () => {
    expect(formatUsage(usage)).toBe(
      'LLM usage: input 40, cache read 900, cache write 0, output 120 (96% of input from cache)',
    );
    expect(formatUsage({ ...usage, inputTokens: 0, cacheReadTokens: 0 })).toBe(
      'LLM usage: input 0, cache read 0, cache write 0, output 120 (0% of input from cache)',
    );
  });
});
