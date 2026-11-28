import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { LocalTextToSpeech, OpenAiTextToSpeech } from '@thp/adapters';
import type { TextToSpeech } from '@thp/ports';
import type { VideoConfig } from './config.ts';
import { DiskFiles, DiskVoiceStore } from './disk.ts';
import { FfmpegMedia } from './ffmpeg-media.ts';
import { Narrator } from './narrator.ts';

/** Wires the video tool: the chosen voice, a voice cache beside the output, and ffmpeg. */
export function videoContainer(config: VideoConfig) {
  if (ffmpegPath === null) throw new Error('ffmpeg-static has no binary for this platform.');
  const tts: TextToSpeech =
    config.voice.provider === 'openai'
      ? new OpenAiTextToSpeech({ apiKey: config.voice.apiKey })
      : new LocalTextToSpeech();
  // Each voice keeps its own lines, so the silent stand-in never fills the real voice's cache.
  const store = new DiskVoiceStore(join(config.outDir, 'voice', config.voice.provider));
  return {
    voice: new Narrator(tts, store, config.voiceName),
    media: new FfmpegMedia(ffmpegPath),
    files: new DiskFiles(),
  };
}
