import { readFileSync } from 'node:fs';
import { AnthropicLlmClient } from '@thp/adapters';
import type {
  ContentMetric,
  ExtractorMetric,
  GraderMetric,
  PlanMetric,
  PresentationMetric,
} from '@thp/agents';
import { runAssistantEvals } from './evals/assistant-evals.ts';
import { formatReport, type EvalReport } from './evals/eval-report.ts';
import { runExtractorEvals, runGraderEvals } from './evals/grading-evals.ts';
import { runPlannerEvals } from './evals/planner-evals.ts';
import { runPresentationEvals } from './evals/presentation-evals.ts';

/**
 * CLI: `pnpm eval`. Runs every agent against real Claude on fixed cases and exits non-zero when
 * an average drops below evals/thresholds.json. Needs ANTHROPIC_API_KEY; costs real money.
 */
const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
if (apiKey === '') {
  process.stderr.write('ANTHROPIC_API_KEY is required to run the evals against Claude.\n');
  process.exit(1);
}
const model = process.env.ANTHROPIC_MODEL?.trim() ?? '';
const thresholds = JSON.parse(
  readFileSync(new URL('../../../evals/thresholds.json', import.meta.url), 'utf8'),
) as {
  'lesson-planner': Record<PlanMetric, number>;
  assistant: Record<ContentMetric, number>;
  presentations: Record<PresentationMetric, number>;
  'question-extractor': Record<ExtractorMetric, number>;
  grader: Record<GraderMetric, number>;
};

const llm = new AnthropicLlmClient({
  apiKey,
  ...(model === '' ? {} : { model }),
  timeoutMs: 300_000,
});

const suites: readonly [string, () => Promise<EvalReport<string>>][] = [
  ['Lesson planner evals', () => runPlannerEvals(llm, thresholds['lesson-planner'])],
  ['AI assistant evals', () => runAssistantEvals(llm, thresholds.assistant)],
  ['Presentation evals', () => runPresentationEvals(llm, thresholds.presentations)],
  ['Question extractor evals', () => runExtractorEvals(llm, thresholds['question-extractor'])],
  ['Grader evals', () => runGraderEvals(llm, thresholds.grader)],
];

let failed = false;
for (const [title, run] of suites) {
  const report = await run();
  process.stdout.write(`${title}\n${formatReport(report)}\n\n`);
  failed ||= report.failing.length > 0;
}
if (failed) process.exit(1);
