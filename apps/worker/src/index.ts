import { setTimeout as sleep } from 'node:timers/promises';
import { parseDatabaseConfig, parseLlmConfig, parseTtsConfig } from './config.ts';
import { createJobRunner } from './container.ts';
import { runWorkerLoop } from './worker-loop.ts';

/** `pnpm --filter @thp/worker start`: runs background jobs until SIGTERM or SIGINT. */
const database = parseDatabaseConfig(process.env);
const llm = parseLlmConfig(process.env);
const tts = parseTtsConfig(process.env);
for (const config of [database, llm, tts]) {
  if (!config.ok) {
    process.stderr.write(`${config.error}\n`);
    process.exit(1);
  }
}
if (!database.ok || !llm.ok || !tts.ok) process.exit(1);

const runner = createJobRunner(database.value, llm.value, tts.value);
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

process.stdout.write(
  `Worker started (${llm.value.provider} model, ${tts.value.provider} voice).\n`,
);
await runWorkerLoop({
  runNext: () => runner.runNext.execute(),
  sweep: () => runner.sweep.execute(),
  sleep: (ms) => sleep(ms),
  now: () => Date.now(),
  stopped: () => stopping,
  // Only the kind of failure is printed: prompts, student work and secrets never reach the log.
  onError: (error) => {
    process.stderr.write(
      `Worker iteration failed: ${error instanceof Error ? error.name : 'unknown'}\n`,
    );
  },
});
await runner.close();
process.stdout.write('Worker stopped.\n');
