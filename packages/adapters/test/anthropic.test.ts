import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LlmError } from '@thp/ports';
import { llmClientContract } from '@thp/testing';
import { AnthropicLlmClient, defaultClaudeModel } from '../src/ai/anthropic-llm-client.ts';

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

const sse = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * A recorded streamed Messages API reply: a thinking block (empty) then the text, as the
 * server-sent events the API sends.
 */
const streamEvents = (text: string, stopReason = 'end_turn'): string[] => [
  sse('message_start', {
    type: 'message_start',
    message: {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: defaultClaudeModel,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    },
  }),
  sse('content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'thinking', thinking: '', signature: '' },
  }),
  sse('content_block_delta', {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'signature_delta', signature: 'sig' },
  }),
  sse('content_block_stop', { type: 'content_block_stop', index: 0 }),
  sse('content_block_start', {
    type: 'content_block_start',
    index: 1,
    content_block: { type: 'text', text: '' },
  }),
  sse('content_block_delta', {
    type: 'content_block_delta',
    index: 1,
    delta: { type: 'text_delta', text },
  }),
  sse('content_block_stop', { type: 'content_block_stop', index: 1 }),
  sse('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 5 },
  }),
  sse('message_stop', { type: 'message_stop' }),
];

const streamed = (events: string[], pauseMs = 0) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
  return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
};

const reply = (text: string, stopReason?: string) => streamed(streamEvents(text, stopReason));

const statusFor: Readonly<Record<LlmError['code'], number>> = {
  rate_limited: 429,
  unavailable: 529,
  invalid_request: 400,
  refused: 200,
};

const client = () => new AnthropicLlmClient({ apiKey: 'test-key', baseURL, maxRetries: 0 });

llmClientContract('AnthropicLlmClient', {
  replying: (text) => {
    server.use(http.post(endpoint, () => reply(text)));
    return client();
  },
  failing: (code) => {
    server.use(
      http.post(endpoint, () =>
        code === 'refused'
          ? reply('', 'refusal')
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

  it('streams from Sonnet by default, with the system prompt, messages and server-side fallbacks', async () => {
    let sent: { body: unknown; beta: string | null } | null = null;
    server.use(
      http.post(endpoint, async ({ request: req }) => {
        sent = { body: await req.json(), beta: req.headers.get('anthropic-beta') };
        return reply('ok');
      }),
    );

    expect(await client().complete(request)).toEqual({
      ok: true,
      value: { text: 'ok', stopReason: 'end' },
    });
    expect(defaultClaudeModel).toBe('claude-sonnet-5-5');
    expect(sent).toMatchObject({
      beta: 'server-side-fallback-2026-07-01',
      body: {
        model: 'claude-sonnet-5-5',
        max_tokens: 100,
        system: 'Be brief.',
        messages: [{ role: 'user', content: 'Hi' }],
        fallbacks: 'default',
        stream: true,
      },
    });
    expect(Object.keys((sent as unknown as { body: object }).body)).not.toContain('temperature');
  });

  it('uses the configured model and reports a cut-off reply', async () => {
    let model: unknown;
    server.use(
      http.post(endpoint, async ({ request: req }) => {
        model = ((await req.json()) as { model: string }).model;
        return reply('partial', 'max_tokens');
      }),
    );
    const custom = new AnthropicLlmClient({
      apiKey: 'k',
      baseURL,
      maxRetries: 0,
      model: 'claude-opus-5-5',
    });

    expect(await custom.complete(request)).toEqual({
      ok: true,
      value: { text: 'partial', stopReason: 'max_tokens' },
    });
    expect(model).toBe('claude-opus-5-5');
  });

  it('waits for a reply that streams longer than the timeout, without sending the request again', async () => {
    let requests = 0;
    server.use(
      http.post(endpoint, () => {
        requests += 1;
        return streamed(streamEvents('a long draft'), 40);
      }),
    );
    const patient = new AnthropicLlmClient({ apiKey: 'k', baseURL, timeoutMs: 100, maxRetries: 2 });

    expect(await patient.complete(request)).toEqual({
      ok: true,
      value: { text: 'a long draft', stopReason: 'end' },
    });
    expect(requests).toBe(1);
  });

  it('still retries a rate limit before the reply starts', async () => {
    let requests = 0;
    server.use(
      http.post(endpoint, () => {
        requests += 1;
        return requests === 1
          ? HttpResponse.json(
              { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } },
              { status: 429, headers: { 'retry-after-ms': '0' } },
            )
          : reply('ok');
      }),
    );
    const retrying = new AnthropicLlmClient({ apiKey: 'k', baseURL, maxRetries: 2 });

    expect(await retrying.complete(request)).toEqual({
      ok: true,
      value: { text: 'ok', stopReason: 'end' },
    });
    expect(requests).toBe(2);
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
