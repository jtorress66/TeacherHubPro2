import {
  AnthropicLlmClient,
  createDatabase,
  createPostgresRepositories,
  LocalTextToSpeech,
  OpenAiTextToSpeech,
  PostgresFileStore,
  UnpdfTextExtractor,
  createStripeClient,
  ensureStripePrices,
  LocalLlmClient,
  migrateToLatest,
  PostgresJobQueue,
  SystemClock,
  UuidIdGenerator,
} from '@thp/adapters';
import {
  ContentWriter,
  LessonPlanner,
  PresentationWriter,
  QuestionExtractor,
  SubmissionGrader,
} from '@thp/agents';
import {
  GenerationHandler,
  GradingHandler,
  PdfImportHandler,
  JobHandlerRegistry,
  LessonPlanDraftHandler,
  PresentationDraftHandler,
  SpeechHandler,
  RunNextJob,
  SweepStaleJobs,
} from '@thp/application';
import type { LlmClient, TextToSpeech } from '@thp/ports';
import type { DatabaseConfig, LlmConfig, StripeConfig, TtsConfig } from './config.ts';
import { localReply } from './local-replies.ts';

// Composition root: the only place in the worker where concrete adapters are created.

function llmClient(config: LlmConfig): LlmClient {
  if (config.provider === 'local') return new LocalLlmClient(localReply);
  return new AnthropicLlmClient({
    apiKey: config.apiKey,
    ...(config.model === null ? {} : { model: config.model }),
  });
}

function textToSpeech(config: TtsConfig): TextToSpeech {
  if (config.provider === 'local') return new LocalTextToSpeech();
  return new OpenAiTextToSpeech({ apiKey: config.apiKey });
}

/** The job runner: every job kind the worker handles is registered here. */
export function createJobRunner(database: DatabaseConfig, llm: LlmConfig, tts: TtsConfig) {
  const db = createDatabase(database.databaseUrl);
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();
  const jobs = new PostgresJobQueue(db, ids);
  const model = llmClient(llm);
  const { generations, assignments, submissions, classes } = createPostgresRepositories(db);
  const files = new PostgresFileStore(db);
  const handlers = new JobHandlerRegistry([
    new LessonPlanDraftHandler(new LessonPlanner(model)),
    new GenerationHandler({ writer: new ContentWriter(model), generations, ids, clock }),
    new PresentationDraftHandler(new PresentationWriter(model)),
    new SpeechHandler({ tts: textToSpeech(tts), files }),
    new PdfImportHandler({
      files,
      pdfText: new UnpdfTextExtractor(),
      questionExtractor: new QuestionExtractor(model),
    }),
    new GradingHandler({ assignments, submissions, classes, grader: new SubmissionGrader(model) }),
  ]);
  return {
    runNext: new RunNextJob({ jobs, handlers }),
    sweep: new SweepStaleJobs({ jobs, clock }),
    close: () => db.destroy(),
  };
}

/** Opens a connection, applies pending migrations and closes it again. */
export async function runMigrations({ databaseUrl }: DatabaseConfig) {
  const db = createDatabase(databaseUrl);
  try {
    return await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
}

/** Makes sure Stripe has a product and price for every plan in the catalog. */
export function setUpStripePrices({ secretKey }: StripeConfig) {
  return ensureStripePrices(createStripeClient(secretKey));
}
