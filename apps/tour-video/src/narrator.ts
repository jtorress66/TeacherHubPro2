import { createHash } from 'node:crypto';
import { ok, type Language, type Result } from '@thp/domain';
import type { TextToSpeech, TextToSpeechError } from '@thp/ports';

/** How the narrator speaks, in every language. */
export const narratorStyle =
  'A confident, authoritative and warm narrator for a product demo for school leaders and teachers. Steady, unhurried pace, clear diction, natural pauses between sentences. Speak naturally in the language of the text.';

/** Where spoken lines are kept between runs, by a key that changes when the line would. */
export interface VoiceStore {
  has(key: string): Promise<boolean>;
  write(key: string, audio: Uint8Array): Promise<void>;
  /** The file ffmpeg reads for a key. */
  path(key: string): string;
}

/**
 * Speaks a line through a voice service and keeps it, so rerunning the videos only pays for
 * lines that changed.
 */
export class Narrator {
  constructor(
    private readonly tts: TextToSpeech,
    private readonly store: VoiceStore,
    private readonly voice: string,
  ) {}

  async speak(text: string, language: Language): Promise<Result<string, TextToSpeechError>> {
    const key = createHash('sha256')
      .update(JSON.stringify([this.voice, narratorStyle, language, text]))
      .digest('hex');
    if (await this.store.has(key)) return ok(this.store.path(key));
    const speech = await this.tts.synthesize({
      text,
      language,
      voice: this.voice,
      style: narratorStyle,
    });
    if (!speech.ok) return speech;
    await this.store.write(key, speech.value.audio);
    return ok(this.store.path(key));
  }
}
