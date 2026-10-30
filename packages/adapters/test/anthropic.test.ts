import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LlmError } from '@thp/ports';
import { llmClientContract } from '@thp/testing';
import { AnthropicLlmClient } from '../src/ai/anthropic-llm-client.ts';

const baseURL = 'https://claude.test';
const endpoint = `${baseURL}/v1/messages`;
const server = setupServer();
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** A recorded Messages API reply: a thinking block (empty by default) then the text. */
const message = (text: string, stopReason = 'end_turn') => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text },
  ],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
});

const statusFor: Readonly<Record<LlmError['code'], number>> = {
  rate_limited: 429,
  unavailable: 529,
  invalid_request: 400,
  refused: 200,
};

const client = () => new AnthropicLlmClient({ apiKey: 'test-key', baseURL, maxRetries: 0 });

llmClientContract('AnthropicLlmClient', {
  replying: (text) => {
    server.use(http.post(endpoint, () => HttpResponse.json(message(text))));
    return client();
  },
  failing: (code) => {
    server.use(
      http.post(endpoint, () =>
        code === 'refused'
          ? HttpResponse.json(message('', 'refusal'))
          : HttpResponse.json(
              { type: 'error', error: { type: 'error', message: 'recorded' } },
              { status: statusFor[code] },
            ),
      ),
    );
    return client();
  },
});

describe('AnthropicLlmClient', () => {
  const request = {
    system: 'Be brief.',
    messages: [{ role: 'user' as const, content: 'Hi' }],
    maxTokens: 100,
  };

  it('sends the model, system prompt and messages, with server-side fallbacks', async () => {
    let sent: { body: unknown; beta: string | null } | null = null;
    server.use(
      http.post(endpoint, async ({ request: req }) => {
        sent = { body: await req.json(), beta: req.headers.get('anthropic-beta') };
        return HttpResponse.json(message('ok'));
      }),
    );

    await client().complete(request);

    expect(sent).toMatchObject({
      beta: 'server-side-fallback-2026-07-01',
      body: {
        model: 'claude-opus-5-5',
        max_tokens: 100,
        system: 'Be brief.',
        messages: [{ role: 'user', content: 'Hi' }],
        fallbacks: 'default',
      },
    });
    expect(Object.keys((sent as unknown as { body: object }).body)).not.toContain('temperature');
  });

  it('uses the configured model and reports a cut-off reply', async () => {
    let model: unknown;
    server.use(
      http.post(endpoint, async ({ request: req }) => {
        model = ((await req.json()) as { model: string }).model;
        return HttpResponse.json(message('partial', 'max_tokens'));
      }),
    );
    const custom = new AnthropicLlmClient({
      apiKey: 'k',
      baseURL,
      maxRetries: 0,
      model: 'claude-sonnet-5-5',
    });

    expect(await custom.complete(request)).toEqual({
      ok: true,
      value: { text: 'partial', stopReason: 'max_tokens' },
    });
    expect(model).toBe('claude-sonnet-5-5');
  });

  it.each([
    [500, 'unavailable'],
    [408, 'unavailable'],
    [401, 'invalid_request'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    server.use(http.post(endpoint, () => HttpResponse.json({}, { status })));
    expect(await client().complete(request)).toEqual({ ok: false, error: { code } });
  });

  it('reports a network failure as unavailable', async () => {
    server.use(http.post(endpoint, () => HttpResponse.error()));
    expect(await client().complete(request)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});
