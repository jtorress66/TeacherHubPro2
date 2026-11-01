import { describe, expect, it } from 'vitest';
import { err, ok } from '@thp/domain';
import { FakeLlmClient } from '@thp/testing';
import { draftWithReview } from './draft-with-review.ts';

const review = (reply: { text: string }) =>
  reply.text.startsWith('good') ? ok(reply.text.toUpperCase()) : err('it was not good.');

const ask = (llm: FakeLlmClient) =>
  draftWithReview(llm, {
    system: 'You write good things.',
    prompt: 'Write something good.',
    maxTokens: 100,
    review,
    retry: (problem) => `Fix it: ${problem}`,
  });

describe('draftWithReview', () => {
  it('returns the reviewed value of a usable first reply', async () => {
    const llm = new FakeLlmClient().replyWith('good one');
    expect(await ask(llm)).toEqual(ok('GOOD ONE'));
    expect(llm.requests[0]).toEqual({
      system: 'You write good things.',
      messages: [{ role: 'user', content: 'Write something good.' }],
      maxTokens: 100,
    });
  });

  it('retries once, telling the model what was wrong', async () => {
    const llm = new FakeLlmClient().replyWith('bad').replyWith('good two');
    expect(await ask(llm)).toEqual(ok('GOOD TWO'));
    expect(llm.requests[1]?.messages).toEqual([
      { role: 'user', content: 'Write something good.' },
      { role: 'assistant', content: 'bad' },
      { role: 'user', content: 'Fix it: it was not good.' },
    ]);
  });

  it('marks the prompt’s stable prefix on the first request and the retry', async () => {
    const llm = new FakeLlmClient().replyWith('bad').replyWith('good three');
    await draftWithReview(llm, {
      system: 'You write good things.',
      prompt: 'Shared rules. This request.',
      stablePrefix: 'Shared rules. ',
      maxTokens: 100,
      review,
      retry: (problem) => `Fix it: ${problem}`,
    });
    expect(llm.requests[1]?.messages[0]).toEqual({
      role: 'user',
      content: 'Shared rules. This request.',
      stablePrefix: 'Shared rules. ',
    });
  });

  it('refuses a stable prefix the prompt does not start with (a programmer error)', async () => {
    await expect(
      draftWithReview(new FakeLlmClient().replyWith('good'), {
        system: 'S',
        prompt: 'This request.',
        stablePrefix: 'Shared rules.',
        maxTokens: 100,
        review,
        retry: (problem) => problem,
      }),
    ).rejects.toThrow('stable prefix');
  });

  it('gives up with invalid_output after two unusable replies', async () => {
    const llm = new FakeLlmClient().replyWith('bad').replyWith('worse');
    expect(await ask(llm)).toEqual(err({ code: 'invalid_output' }));
  });

  it('reports a failing model as ai_unavailable', async () => {
    const llm = new FakeLlmClient().failWith('rate_limited');
    expect(await ask(llm)).toEqual(err({ code: 'ai_unavailable' }));
  });
});
