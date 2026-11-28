import { describe, expect, it } from 'vitest';
import { FakeTextToSpeech } from '@thp/testing';
import { Narrator, narratorStyle, type VoiceStore } from './narrator.ts';

class MemoryStore implements VoiceStore {
  readonly files = new Map<string, Uint8Array>();
  has(key: string) {
    return Promise.resolve(this.files.has(key));
  }
  write(key: string, audio: Uint8Array) {
    this.files.set(key, audio);
    return Promise.resolve();
  }
  path(key: string) {
    return `voice/${key}.mp3`;
  }
}

describe('Narrator', () => {
  it('asks the voice service for the line, in its language, with the narrator’s voice and style', async () => {
    const tts = new FakeTextToSpeech();
    const store = new MemoryStore();
    const result = await new Narrator(tts, store, 'coral').speak('Hola clase', 'es');

    expect(narratorStyle).toMatch(/authoritative/u);
    expect(tts.requests).toEqual([
      { text: 'Hola clase', language: 'es', voice: 'coral', style: narratorStyle },
    ]);
    expect(result.ok && result.value).toMatch(/^voice\/[0-9a-f]{64}\.mp3$/u);
    expect(store.files.size).toBe(1);
  });

  it('reuses a line already spoken, so a rerun costs nothing', async () => {
    const tts = new FakeTextToSpeech();
    const narrator = new Narrator(tts, new MemoryStore(), 'coral');
    const first = await narrator.speak('Welcome', 'en');
    const again = await narrator.speak('Welcome', 'en');
    await narrator.speak('Welcome', 'fr');
    await new Narrator(tts, new MemoryStore(), 'sage').speak('Welcome', 'en');

    expect(again).toEqual(first);
    expect(tts.requests.map((r) => `${r.voice}:${r.language}`)).toEqual([
      'coral:en',
      'coral:fr',
      'sage:en',
    ]);
  });

  it('passes on the voice service’s failure', async () => {
    const result = await new Narrator(
      new FakeTextToSpeech('rate_limited'),
      new MemoryStore(),
      'coral',
    ).speak('Hi', 'en');
    expect(result).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });
});
