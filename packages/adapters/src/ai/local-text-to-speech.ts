import { err, ok, type Result } from '@thp/domain';
import type { Speech, TextToSpeech, TextToSpeechError } from '@thp/ports';

/** One silent MPEG-2 Layer III frame (8 kbit/s, 22.05 kHz, mono): 26 bytes, header then zeros. */
const frame = [0xff, 0xf3, 0x10, 0xc4, ...Array.from({ length: 22 }, () => 0)];
/** About a quarter of a second of silence. */
const silence = new Uint8Array(Array.from({ length: 10 }, () => frame).flat());

/**
 * A stand-in for a voice service in local runs and E2E tests: always a short silent mp3, never
 * the network. Given a failure code, it always fails with it.
 */
export class LocalTextToSpeech implements TextToSpeech {
  constructor(private readonly failure?: TextToSpeechError['code']) {}

  synthesize(): Promise<Result<Speech, TextToSpeechError>> {
    if (this.failure !== undefined) return Promise.resolve(err({ code: this.failure }));
    return Promise.resolve(ok({ audio: silence.slice(), mimeType: 'audio/mpeg' }));
  }
}
