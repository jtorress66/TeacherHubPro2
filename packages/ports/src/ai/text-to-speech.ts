import type { Language, Result } from '@thp/domain';

export interface SpeechRequest {
  readonly text: string;
  readonly voice: string;
  readonly language: Language;
}

export interface Speech {
  readonly audio: Uint8Array;
  readonly mimeType: string;
}

export interface TextToSpeechError {
  readonly code: 'rate_limited' | 'unavailable' | 'invalid_request';
}

export interface TextToSpeech {
  synthesize(request: SpeechRequest): Promise<Result<Speech, TextToSpeechError>>;
}
