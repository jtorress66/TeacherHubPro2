import { readFileSync } from 'node:fs';
import { AnthropicLlmClient } from '@thp/adapters';
import type { PlanMetric } from '@thp/agents';
import { formatReport, runPlannerEvals } from './evals/planner-evals.ts';

/**
 * CLI: `pnpm eval`. Runs the lesson planner against real Claude on fixed cases and exits non-zero
 * when an average drops below evals/thresholds.json. Needs ANTHROPIC_API_KEY; costs real money.
 */
const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
if (apiKey === '') {
  process.stderr.write('ANTHROPIC_API_KEY is required to run the evals against Claude.\n');
  process.exit(1);
}
const model = process.env.ANTHROPIC_MODEL?.trim() ?? '';
const thresholds = (
  JSON.parse(readFileSync(new URL('../../../evals/thresholds.json', import.meta.url), 'utf8')) as {
    'lesson-planner': Record<PlanMetric, number>;
  }
)['lesson-planner'];

const report = await runPlannerEvals(
  new AnthropicLlmClient({ apiKey, ...(model === '' ? {} : { model }), timeoutMs: 300_000 }),
  thresholds,
);
process.stdout.write(`Lesson planner evals\n${formatReport(report)}\n`);
if (report.failing.length > 0) process.exit(1);
