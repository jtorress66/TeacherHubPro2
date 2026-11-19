import {
  AesGcmCipher,
  AnthropicLlmClient,
  HttpLtiGradesClient,
  localLtiSealKey,
  NodeRandomTokenGenerator,
  PostgresToolKeyStore,
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
  loggedMailer,
  PostgresJobQueue,
  ResendMailer,
  SystemClock,
  UuidIdGenerator,
} from '@thp/adapters';
import { emailTemplates } from '@thp/i18n';
import {
  ContentWriter,
  LessonPlanner,
  PresentationWriter,
  RubricWriter,
  GameWriter,
  PathWriter,
  QuestionExtractor,
  InsightWriter,
  QuizWriter,
  ChatbotAgent,
  SubmissionGrader,
} from '@thp/agents';
import {
  GameDraftHandler,
  LearningPathHandler,
  GenerationHandler,
  GradingHandler,
  PdfImportHandler,
  StudentInsightHandler,
  JobHandlerRegistry,
  makePrepRunners,
  PrepStepHandler,
  LessonPlanDraftHandler,
  PresentationDraftHandler,
  RubricDraftHandler,
  SpeechHandler,
  RunNextJob,
  RunNextChatTurn,
  SweepOldChats,
  DeleteDueSchools,
  SendTrialReminders,
  SweepStaleJobs,
  LtiGradeSendHandler,
  type JobHandler,
} from '@thp/application';
import type { LlmClient, Mailer, MailTemplates, TextToSpeech } from '@thp/ports';
import type {
  DatabaseConfig,
  LlmConfig,
  LtiConfig,
  MailConfig,
  StripeConfig,
  TtsConfig,
} from './config.ts';
import { localReply } from './local-replies.ts';
import { chatFirst } from './worker-loop.ts';

// Composition root: the only place in the worker where concrete adapters are created.

/** Printed when Claude refuses the key itself; the key is never printed. */
export const keyRefusedMessage =
  'Claude refused ANTHROPIC_API_KEY (expired, deleted or wrong). AI writing fails until it is replaced.';

const claudeClient = (config: Extract<LlmConfig, { provider: 'anthropic' }>) =>
  new AnthropicLlmClient({
    apiKey: config.apiKey,
    ...(config.model === null ? {} : { model: config.model }),
    onKeyRefused: () => {
      process.stderr.write(`${keyRefusedMessage}\n`);
    },
  });

/** At start: a free check that Claude accepts the key, so a bad key shows in the log at once. */
export async function checkClaudeKey(config: LlmConfig): Promise<string> {
  if (config.provider === 'local') return 'AI key check skipped (local model).';
  const found = await claudeClient(config).checkKey();
  if (found === 'refused') return keyRefusedMessage;
  return found === 'ok'
    ? 'Claude accepted the API key.'
    : 'Claude could not be reached to check the API key.';
}

/** Claude reports each call's token usage (numbers only) to stdout, to watch cache hit rates. */
function llmClient(config: LlmConfig): LlmClient {
  if (config.provider === 'local') return new LocalLlmClient(localReply);
  const claude = claudeClient(config);
  return new UsageReportingLlmClient(claude, (usage) => {
    process.stdout.write(`${formatUsage(usage)}\n`);
  });
}

function textToSpeech(config: TtsConfig): TextToSpeech {
  if (config.provider === 'local') return new LocalTextToSpeech();
  return new OpenAiTextToSpeech({ apiKey: config.apiKey });
}

/** Email wording, from the translations, branded for the site; the same templates the web app uses. */
export const mailTemplatesFor = (appUrl: string): MailTemplates => emailTemplates(appUrl);

function mailerFor(config: MailConfig, db: ReturnType<typeof createDatabase>): Mailer {
  return config.provider === 'resend'
    ? loggedMailer(
        new ResendMailer({
          apiKey: config.apiKey,
          from: config.from,
          ...(config.replyTo === undefined ? {} : { replyTo: config.replyTo }),
        }),
        (line) => process.stdout.write(line),
      )
    : new LocalMailer(db);
}

/**
 * Sending grades to schools' course systems (LTI), when it is on: signed with the tool's key,
 * sealed as the web app seals it (a fixed key for the pretend course system).
 */
function ltiHandlers(
  config: LtiConfig,
  db: ReturnType<typeof createDatabase>,
  deps: ReturnType<typeof createPostgresRepositories> & {
    readonly ids: UuidIdGenerator;
    readonly clock: SystemClock;
  },
): JobHandler[] {
  if (config.provider === 'off') return [];
  const tokens = new NodeRandomTokenGenerator();
  const cipher = new AesGcmCipher(
    config.provider === 'local' ? localLtiSealKey() : config.encryptionKey,
  );
  const toolKeys = new PostgresToolKeyStore(db, { cipher, tokens, clock: deps.clock });
  return [
    new LtiGradeSendHandler({
      ...deps,
      ltiGrades: new HttpLtiGradesClient({ signer: toolKeys, clock: deps.clock, tokens }),
    }),
  ];
}

/** The job runner: every job kind the worker handles is registered here. */
export function createJobRunner(
  database: DatabaseConfig,
  llm: LlmConfig,
  tts: TtsConfig,
  mail: MailConfig,
  lti: LtiConfig,
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
    new GenerationHandler({ writer: new ContentWriter(model), generations, ids, clock, jobs }),
    new PresentationDraftHandler(new PresentationWriter(model)),
    new RubricDraftHandler(new RubricWriter(model)),
    new SpeechHandler({ tts: textToSpeech(tts), files }),
    new PdfImportHandler({
      files,
      pdfText: new UnpdfTextExtractor(),
      questionExtractor: new QuestionExtractor(model),
    }),
    new GradingHandler({ assignments, submissions, classes, grader: new SubmissionGrader(model) }),
    new GameDraftHandler({ gameWriter: new GameWriter(model) }),
    new StudentInsightHandler({
      ...repos,
      insightWriter: new InsightWriter(model),
      clock,
    }),
    new LearningPathHandler({ pathWriter: new PathWriter(model), learningPaths, ids, clock }),
    new PrepStepHandler({
      prepBatches: repos.prepBatches,
      jobs,
      clock,
      runners: makePrepRunners({
        drafter: new LessonPlanner(model),
        presentationDrafter: new PresentationWriter(model),
        contentWriter: new ContentWriter(model),
        quizWriter: new QuizWriter(model),
        lessonPlans: repos.lessonPlans,
      }),
    }),
    ...ltiHandlers(lti, db, { ...repos, ids, clock }),
  ]);
  const sweep = new SweepStaleJobs({ jobs, clock });
  const reminders = new SendTrialReminders({
    subscriptions: repos.subscriptions,
    trialReminders: repos.trialReminders,
    users: repos.users,
    mailer: mailerFor(mail, db),
    mailTemplates: mailTemplatesFor(mail.appUrl),
    clock,
    appUrl: mail.appUrl,
  });
  const runChat = new RunNextChatTurn({ ...repos, chatbot: new ChatbotAgent(model) });
  const sweepChats = new SweepOldChats({ chatSessions: repos.chatSessions, clock });
  const deleteSchools = new DeleteDueSchools({ ...repos, clock });
  const runJobs = new RunNextJob({ jobs, handlers });
  return {
    runNext: {
      execute: chatFirst(
        () => runChat.execute(),
        () => runJobs.execute(),
      ),
    },
    /**
     * Once a minute: stale jobs, old chats, schools whose deletion hold is over, then trial
     * reminders (each goes out once, when mail reaches people).
     */
    housekeeping: async () => {
      const swept = await sweep.execute();
      await sweepChats.execute();
      await deleteSchools.execute();
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
