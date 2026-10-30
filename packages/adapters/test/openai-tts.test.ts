import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { TextToSpeech, TextToSpeechError } from '@thp/ports';
import { textToSpeechContract } from '@thp/testing';
import { LocalTextToSpeech } from '../src/ai/local-text-to-speech.ts';
import { OpenAiTextToSpeech } from '../src/ai/openai-text-to-speech.ts';

const baseURL = 'https://openai.test/v1';
const endpoint = `${baseURL}/audio/speech`;
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

/** A recorded speech reply: mp3 bytes. */
const mp3 = new Uint8Array([0xff, 0xf3, 0x44, 0xc4, 0x00, 0x00]);

const statusFor: Readonly<Record<TextToSpeechError['code'], number>> = {
  rate_limited: 429,
  unavailable: 503,
  invalid_request: 400,
};

const client = () => new OpenAiTextToSpeech({ apiKey: 'test-key', baseURL, maxRetries: 0 });

textToSpeechContract('OpenAiTextToSpeech', {
  working: () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.arrayBuffer(mp3.buffer, { headers: { 'content-type': 'audio/mpeg' } }),
      ),
    );
    return client();
  },
  failing: (code) => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json({ error: { message: 'recorded' } }, { status: statusFor[code] }),
      ),
    );
    return client();
  },
});

textToSpeechContract('LocalTextToSpeech', {
  working: () => new LocalTextToSpeech(),
  failing: (code) => new LocalTextToSpeech(code),
});

describe('OpenAiTextToSpeech', () => {
  it('asks for mp3 from the configured model with the request’s text and voice', async () => {
    let sent: unknown;
    server.use(
      http.post(endpoint, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.arrayBuffer(mp3.buffer, { headers: { 'content-type': 'audio/mpeg' } });
      }),
    );

    const result = await client().synthesize({ text: 'Hola clase', voice: 'nova', language: 'es' });

    expect(sent).toEqual({
      model: 'gpt-4o-mini-tts',
      input: 'Hola clase',
      voice: 'nova',
      response_format: 'mp3',
    });
    expect(result).toEqual({ ok: true, value: { audio: mp3, mimeType: 'audio/mpeg' } });
  });

  it.each(Object.entries(statusFor))('maps %s', async (code, status) => {
    server.use(
      http.post(endpoint, () => HttpResponse.json({ error: { message: 'x' } }, { status })),
    );
    expect(await client().synthesize({ text: 'Hi', voice: 'nova', language: 'en' })).toEqual({
      ok: false,
      error: { code },
    });
  });

  it('reports a network failure as unavailable', async () => {
    server.use(http.post(endpoint, () => HttpResponse.error()));
    expect(await client().synthesize({ text: 'Hi', voice: 'nova', language: 'en' })).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});

describe('LocalTextToSpeech', () => {
  it('returns a small valid mp3 whatever the text', async () => {
    const tts: TextToSpeech = new LocalTextToSpeech();
    const result = await tts.synthesize({
      text: 'Hola',
      voice: 'nova',
      language: 'es',
    });
    expect(result.ok && result.value.mimeType).toBe('audio/mpeg');
    expect(result.ok && [...result.value.audio.slice(0, 2)]).toEqual([0xff, 0xf3]);
  });
});
