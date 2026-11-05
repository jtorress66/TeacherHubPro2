import {
  err,
  ok,
  type AiScores,
  type ContentRequest,
  type ExtractedTest,
  type GradingRequest,
  type Language,
  type DraftRequest,
  type LessonPlanDraft,
  type PresentationDraft,
  type PresentationRequest,
  type QuestionId,
  type Result,
} from '@thp/domain';
import type {
  QuestionExtractor,
  InsightRequest,
  InsightWriter,
  QuizRequest,
  QuizWriter,
  SubmissionGrader,
  ContentWriter,
  PresentationDrafter,
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

/** A scripted content writer: returns the given Markdown (or error) and records each request. */
export class FakeContentWriter implements ContentWriter {
  readonly requests: ContentRequest[] = [];

  constructor(private readonly outcome: Result<string, DraftError>) {}

  write(request: ContentRequest): Promise<Result<string, DraftError>> {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

/** A scripted slide drafter: returns the given draft (or error) and records each request. */
export class FakePresentationDrafter implements PresentationDrafter {
  readonly requests: PresentationRequest[] = [];

  constructor(private readonly outcome: Result<PresentationDraft, DraftError>) {}

  draft(request: PresentationRequest): Promise<Result<PresentationDraft, DraftError>> {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

/** A small valid slide draft for tests. */
export const aPresentationDraft = (
  overrides: Partial<PresentationDraft> = {},
): PresentationDraft => ({
  title: 'Volcanoes',
  slides: [
    { layout: 'title', title: 'Volcanoes', subtitle: 'Mountains of fire', emoji: '🌋' },
    { layout: 'content', title: 'How they form', bullets: ['Magma rises', 'Pressure builds'] },
    { layout: 'quote', title: 'Remember', content: 'Lava is magma above ground.' },
  ],
  ...overrides,
});

/** A scripted question extractor: returns the given test (or error) and records each input. */
export class FakeQuestionExtractor implements QuestionExtractor {
  readonly inputs: { readonly text: string; readonly language: Language }[] = [];

  constructor(private readonly outcome: Result<ExtractedTest, DraftError>) {}

  extract(input: { readonly text: string; readonly language: Language }) {
    this.inputs.push(input);
    return Promise.resolve(this.outcome);
  }
}

/** Returns the same bullets (or failure) for every student, and records what it was sent. */
export class FakeInsightWriter implements InsightWriter {
  readonly requests: InsightRequest[] = [];

  constructor(
    private readonly outcome: Result<readonly string[], DraftError> = ok([
      'Scores fell over the last three assignments.',
      'Two absences this month.',
      'Check in about the missing essay.',
    ]),
  ) {}

  write(request: InsightRequest) {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

/**
 * A grader that gives every open answer the same share of its points (or fails), and records
 * each request so tests can check what the AI would be sent.
 */
export class FakeSubmissionGrader implements SubmissionGrader {
  readonly requests: GradingRequest[] = [];

  constructor(private readonly share: number | DraftError['code'] = 0.5) {}

  grade(request: GradingRequest): Promise<Result<AiScores, DraftError>> {
    this.requests.push(request);
    const share = this.share;
    if (typeof share !== 'number') return Promise.resolve(err({ code: share }));
    return Promise.resolve(
      ok({
        scores: Object.fromEntries(
          request.questions.map((q) => [
            q.id,
            { score: q.points * share, feedback: 'Good effort' },
          ]),
        ),
        feedback: 'Keep going',
      }),
    );
  }
}

/** A small valid quiz for tests. */
export const aQuiz = (): ExtractedTest => ({
  instructions: 'Answer every question.',
  questions: [
    {
      id: 'q1' as QuestionId,
      type: 'multiple_choice',
      prompt: 'Which fraction equals 1/2?',
      points: 1,
      instructions: null,
      options: ['2/4', '1/3'],
      correctOption: 0,
    },
    {
      id: 'q2' as QuestionId,
      type: 'true_false',
      prompt: '3/4 is more than 1/2.',
      points: 1,
      instructions: null,
      answer: true,
    },
  ],
});

/** A scripted quiz writer: returns the given quiz (or error) and records each request. */
export class FakeQuizWriter implements QuizWriter {
  readonly requests: QuizRequest[] = [];

  constructor(private readonly outcome: Result<ExtractedTest, DraftError> = ok(aQuiz())) {}

  write(request: QuizRequest): Promise<Result<ExtractedTest, DraftError>> {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}
