import { err, ok, type DraftRequest, type LessonPlanDraft, type Result } from '@thp/domain';
import type {
  DraftError,
  LessonPlanDrafter,
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

/** A scripted drafter: returns the given draft (or error) and records each request. */
export class FakeLessonPlanDrafter implements LessonPlanDrafter {
  readonly requests: DraftRequest[] = [];

  constructor(private readonly outcome: Result<LessonPlanDraft, DraftError>) {}

  draft(request: DraftRequest): Promise<Result<LessonPlanDraft, DraftError>> {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

/** A small valid weekly draft for tests. */
export const aWeeklyDraft = (overrides: Partial<LessonPlanDraft> = {}): LessonPlanDraft =>
  ({
    kind: 'weekly',
    unit: 'Fractions',
    objective: 'Compare fractions',
    skills: ['Equivalence'],
    standards: ['CCSS.Math.Content.4.NF.A.1'],
    expectations: null,
    days: [{ theme: 'Hook' }, {}, {}, {}, {}],
    ...overrides,
  }) as LessonPlanDraft;
