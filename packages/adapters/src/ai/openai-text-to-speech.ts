import OpenAI from 'openai';
import { err, ok, type Result } from '@thp/domain';
import type { Speech, SpeechRequest, TextToSpeech, TextToSpeechError } from '@thp/ports';

export const defaultSpeechModel = 'gpt-4o-mini-tts';

export interface OpenAiSpeechConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  /** The SDK retries rate limits and server errors this many times. */
  readonly maxRetries?: number;
  readonly baseURL?: string;
}

/** 4xx other than timeouts, conflicts and rate limits cannot succeed on retry. */
function errorCode(error: unknown): TextToSpeechError['code'] {
  if (error instanceof OpenAI.RateLimitError) return 'rate_limited';
  const status: unknown = error instanceof OpenAI.APIError ? error.status : undefined;
  const retryable = typeof status !== 'number' || status >= 500 || [408, 409].includes(status);
  return retryable ? 'unavailable' : 'invalid_request';
}

/** Text to speech through OpenAI's official SDK, as mp3. Nothing is logged. */
export class OpenAiTextToSpeech implements TextToSpeech {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAiSpeechConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs ?? 60_000,
      maxRetries: config.maxRetries ?? 2,
      ...(config.baseURL === undefined ? {} : { baseURL: config.baseURL }),
    });
    this.model = config.model ?? defaultSpeechModel;
  }

  async synthesize(request: SpeechRequest): Promise<Result<Speech, TextToSpeechError>> {
    try {
      const response = await this.client.audio.speech.create({
        model: this.model,
        input: request.text,
        voice: request.voice,
        response_format: 'mp3',
      });
      return ok({ audio: new Uint8Array(await response.arrayBuffer()), mimeType: 'audio/mpeg' });
    } catch (error) {
      return err({ code: errorCode(error) });
    }
  }
}
