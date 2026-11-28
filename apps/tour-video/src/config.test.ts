import { describe, expect, it } from 'vitest';
import { parseVideoConfig } from './config.ts';

describe('parseVideoConfig', () => {
  it('needs the folder of frames that the tour capture wrote', () => {
    expect(parseVideoConfig({})).toEqual({
      ok: false,
      error: 'Set TOUR_FRAMES to the folder `pnpm tour:capture` wrote frames to.',
    });
  });

  it('uses a silent stand-in voice and every language by default, writing beside the frames', () => {
    expect(parseVideoConfig({ TOUR_FRAMES: 'shots' })).toEqual({
      ok: true,
      value: {
        framesDir: 'shots',
        outDir: 'shots/videos',
        locales: ['en', 'es', 'fr', 'pt', 'de', 'it', 'zh'],
        only: [],
        voice: { provider: 'local' },
        voiceName: 'onyx',
      },
    });
  });

  it('speaks with OpenAI when asked, and only with a key', () => {
    expect(parseVideoConfig({ TOUR_FRAMES: 's', TTS_PROVIDER: 'openai' })).toEqual({
      ok: false,
      error: 'OPENAI_API_KEY is required when TTS_PROVIDER is "openai".',
    });
    const config = parseVideoConfig({
      TOUR_FRAMES: 's',
      TTS_PROVIDER: 'openai',
      OPENAI_API_KEY: ' sk-test ',
      TOUR_VOICE: 'sage',
    });
    expect(config.ok && config.value.voice).toEqual({ provider: 'openai', apiKey: 'sk-test' });
    expect(config.ok && config.value.voiceName).toBe('sage');
  });

  it('can make only some languages and videos, and refuses unknown languages', () => {
    const config = parseVideoConfig({
      TOUR_FRAMES: 's',
      TOUR_LOCALES: 'en, es',
      TOUR_ONLY: 'overview',
      TOUR_VIDEOS_OUT: 'out',
    });
    expect(config.ok && config.value).toMatchObject({
      locales: ['en', 'es'],
      only: ['overview'],
      outDir: 'out',
    });
    expect(parseVideoConfig({ TOUR_FRAMES: 's', TOUR_LOCALES: 'en klingon' })).toEqual({
      ok: false,
      error: 'TOUR_LOCALES has unknown languages: klingon.',
    });
  });
});
