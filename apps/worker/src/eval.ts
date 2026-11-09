import { readFileSync } from 'node:fs';
import { AnthropicLlmClient } from '@thp/adapters';
import type {
  ContentMetric,
  ExtractorMetric,
  GameMetric,
  PathMetric,
  InsightMetric,
  QuizMetric,
  ChatMetric,
  GraderMetric,
  PlanMetric,
  PresentationMetric,
} from '@thp/agents';
import { runAssistantEvals } from './evals/assistant-evals.ts';
import { formatReport, type EvalReport } from './evals/eval-report.ts';
import { runGameEvals } from './evals/game-evals.ts';
import { runInsightEvals } from './evals/insight-evals.ts';
import { runQuizEvals } from './evals/quiz-evals.ts';
import { runChatbotEvals } from './evals/chatbot-evals.ts';
import { runPathEvals } from './evals/path-evals.ts';
import { chooseSuites } from './evals/choose-suites.ts';
import { runExtractorEvals, runGraderEvals } from './evals/grading-evals.ts';
import { runPlannerEvals } from './evals/planner-evals.ts';
import { runPresentationEvals } from './evals/presentation-evals.ts';

/**
 * CLI: `pnpm eval` (or `pnpm eval -- grader game` for some suites). Runs the agents against real
 * Claude on fixed cases and exits non-zero when an average drops below evals/thresholds.json.
 * Needs ANTHROPIC_API_KEY; costs real money.
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
  'game-writer': Record<GameMetric, number>;
  'path-writer': Record<PathMetric, number>;
  'insight-writer': Record<InsightMetric, number>;
  'quiz-writer': Record<QuizMetric, number>;
  chatbot: Record<ChatMetric, number>;
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
  ['Game writer evals', () => runGameEvals(llm, thresholds['game-writer'])],
  ['Path writer evals', () => runPathEvals(llm, thresholds['path-writer'])],
  ['Insight writer evals', () => runInsightEvals(llm, thresholds['insight-writer'])],
  ['Quiz writer evals', () => runQuizEvals(llm, thresholds['quiz-writer'])],
  ['Chatbot evals', () => runChatbotEvals(llm, thresholds.chatbot)],
];

let failed = false;
for (const [title, run] of chooseSuites(suites, process.argv.slice(2))) {
  const report = await run();
  process.stdout.write(`${title}\n${formatReport(report)}\n\n`);
  failed ||= report.failing.length > 0;
}
if (failed) process.exit(1);
