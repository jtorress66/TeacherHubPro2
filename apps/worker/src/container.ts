import {
  AnthropicLlmClient,
  createDatabase,
  createStripeClient,
  ensureStripePrices,
  LocalLlmClient,
  migrateToLatest,
  PostgresJobQueue,
  SystemClock,
  UuidIdGenerator,
} from '@thp/adapters';
import { LessonPlanner } from '@thp/agents';
import {
  JobHandlerRegistry,
  LessonPlanDraftHandler,
  RunNextJob,
  SweepStaleJobs,
} from '@thp/application';
import type { LlmClient } from '@thp/ports';
import type { DatabaseConfig, LlmConfig, StripeConfig } from './config.ts';
import { localPlannerReply } from './local-planner-reply.ts';

// Composition root: the only place in the worker where concrete adapters are created.

function llmClient(config: LlmConfig): LlmClient {
  if (config.provider === 'local') return new LocalLlmClient(localPlannerReply);
  return new AnthropicLlmClient({
    apiKey: config.apiKey,
    ...(config.model === null ? {} : { model: config.model }),
  });
}

/** The job runner: every job kind the worker handles is registered here. */
export function createJobRunner(database: DatabaseConfig, llm: LlmConfig) {
  const db = createDatabase(database.databaseUrl);
  const jobs = new PostgresJobQueue(db, new UuidIdGenerator());
  const handlers = new JobHandlerRegistry([
    new LessonPlanDraftHandler(new LessonPlanner(llmClient(llm))),
  ]);
  return {
    runNext: new RunNextJob({ jobs, handlers }),
    sweep: new SweepStaleJobs({ jobs, clock: new SystemClock() }),
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
