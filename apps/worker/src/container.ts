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
  UsageReportingLlmClient,
  formatUsage,
  migrateToLatest,
  LocalMailer,
  PostgresJobQueue,
  ResendMailer,
  SystemClock,
  UuidIdGenerator,
} from '@thp/adapters';
import { portalLinkEmail, trialReminderEmail } from '@thp/i18n';
import {
  ContentWriter,
  LessonPlanner,
  PresentationWriter,
  GameWriter,
  PathWriter,
  QuestionExtractor,
  TestTranscriber,
  SubmissionGrader,
} from '@thp/agents';
import {
  GameDraftHandler,
  LearningPathHandler,
  GenerationHandler,
  GradingHandler,
  PdfImportHandler,
  TestDocHandler,
  JobHandlerRegistry,
  LessonPlanDraftHandler,
  PresentationDraftHandler,
  SpeechHandler,
  RunNextJob,
  SendTrialReminders,
  SweepStaleJobs,
} from '@thp/application';
import type { LlmClient, Mailer, MailTemplates, TextToSpeech } from '@thp/ports';
import type { DatabaseConfig, LlmConfig, MailConfig, StripeConfig, TtsConfig } from './config.ts';
import { localReply } from './local-replies.ts';

// Composition root: the only place in the worker where concrete adapters are created.

/** Claude reports each call's token usage (numbers only) to stdout, to watch cache hit rates. */
function llmClient(config: LlmConfig): LlmClient {
  if (config.provider === 'local') return new LocalLlmClient(localReply);
  const claude = new AnthropicLlmClient({
    apiKey: config.apiKey,
    ...(config.model === null ? {} : { model: config.model }),
  });
  return new UsageReportingLlmClient(claude, (usage) => {
    process.stdout.write(`${formatUsage(usage)}\n`);
  });
}

function textToSpeech(config: TtsConfig): TextToSpeech {
  if (config.provider === 'local') return new LocalTextToSpeech();
  return new OpenAiTextToSpeech({ apiKey: config.apiKey });
}

/** Email wording, from the translations; the same templates the web app uses. */
export const mailTemplates: MailTemplates = {
  portalLink: portalLinkEmail,
  trialReminder: trialReminderEmail,
};

function mailerFor(config: MailConfig, db: ReturnType<typeof createDatabase>): Mailer {
  return config.provider === 'resend'
    ? new ResendMailer({ apiKey: config.apiKey, from: config.from })
    : new LocalMailer(db);
}

/** The job runner: every job kind the worker handles is registered here. */
export function createJobRunner(
  database: DatabaseConfig,
  llm: LlmConfig,
  tts: TtsConfig,
  mail: MailConfig,
) {
  const db = createDatabase(database.databaseUrl);
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();
  const jobs = new PostgresJobQueue(db, ids);
  const model = llmClient(llm);
  const repos = createPostgresRepositories(db);
  const { generations, assignments, submissions, classes, learningPaths } = repos;
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
    new TestDocHandler({
      files,
      pdfText: new UnpdfTextExtractor(),
      testTranscriber: new TestTranscriber(model),
    }),
    new GradingHandler({ assignments, submissions, classes, grader: new SubmissionGrader(model) }),
    new GameDraftHandler({ gameWriter: new GameWriter(model) }),
    new LearningPathHandler({ pathWriter: new PathWriter(model), learningPaths, ids, clock }),
  ]);
  const sweep = new SweepStaleJobs({ jobs, clock });
  const reminders = new SendTrialReminders({
    subscriptions: repos.subscriptions,
    trialReminders: repos.trialReminders,
    users: repos.users,
    mailer: mailerFor(mail, db),
    mailTemplates,
    clock,
    appUrl: mail.appUrl,
  });
  return {
    runNext: new RunNextJob({ jobs, handlers }),
    /** Once a minute: stale jobs, then trial reminders (each goes out once, when mail reaches people). */
    housekeeping: async () => {
      const swept = await sweep.execute();
      if (mail.delivers) await reminders.execute();
      return swept;
    },
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
