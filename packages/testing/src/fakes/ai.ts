import { err, ok, type Result } from '@thp/domain';
import type {
  LlmClient,
  LlmError,
  LlmRequest,
  LlmResponse,
  Speech,
  SpeechRequest,
  TextToSpeech,
  TextToSpeechError,
} from '@thp/ports';

type ScriptedReply = Result<LlmResponse, LlmError>;

/** Replies with scripted answers in order and records every request. */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];
  private readonly replies: ScriptedReply[] = [];

  replyWith(text: string, stopReason: LlmResponse['stopReason'] = 'end'): this {
    this.replies.push(ok({ text, stopReason }));
    return this;
  }

  failWith(code: LlmError['code']): this {
    this.replies.push(err({ code }));
    return this;
  }

  complete(request: LlmRequest): Promise<ScriptedReply> {
    this.requests.push(request);
    const reply = this.replies.shift();
    if (reply === undefined)
      return Promise.reject(new Error('FakeLlmClient: no scripted reply left'));
    return Promise.resolve(reply);
  }
}

/** Returns the text's bytes as "audio", or a fixed error. */
export class FakeTextToSpeech implements TextToSpeech {
  readonly requests: SpeechRequest[] = [];

  constructor(private readonly failure?: TextToSpeechError['code']) {}

  synthesize(request: SpeechRequest): Promise<Result<Speech, TextToSpeechError>> {
    this.requests.push(request);
    if (this.failure !== undefined) return Promise.resolve(err({ code: this.failure }));
    return Promise.resolve(
      ok({ audio: new TextEncoder().encode(request.text), mimeType: 'audio/mpeg' }),
    );
  }
}
