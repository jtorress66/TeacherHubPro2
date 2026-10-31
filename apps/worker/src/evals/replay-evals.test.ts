import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  ContentMetric,
  ExtractorMetric,
  GraderMetric,
  PlanMetric,
  PresentationMetric,
} from '@thp/agents';
import { assistantCases, runAssistantEvals } from './assistant-evals.ts';
import { formatReport } from './eval-report.ts';
import { extractorCases, graderCases, runExtractorEvals, runGraderEvals } from './grading-evals.ts';
import { plannerCases, runPlannerEvals } from './planner-evals.ts';
import { presentationCases, runPresentationEvals } from './presentation-evals.ts';
import { loadReplays, ReplayLlmClient } from './replay-llm-client.ts';

// The evals, scored on saved model replies instead of calling Claude: free, so they run on every
// push. They catch regressions in prompts' shapes, parsing, validation and scoring; only a real
// run (`pnpm eval`, on request) shows how the model itself behaves.

const thresholds = JSON.parse(
  readFileSync(new URL('../../../../evals/thresholds.json', import.meta.url), 'utf8'),
) as {
  'lesson-planner': Record<PlanMetric, number>;
  assistant: Record<ContentMetric, number>;
  presentations: Record<PresentationMetric, number>;
  'question-extractor': Record<ExtractorMetric, number>;
  grader: Record<GraderMetric, number>;
};

const replay = (suite: string) => new ReplayLlmClient(loadReplays(suite));

describe('replay evals (saved replies, no API calls)', () => {
  it('has a saved reply for every case', () => {
    const topics = (suite: string) => Object.keys(loadReplays(suite)).sort();
    expect(topics('planner')).toEqual(plannerCases.map((c) => c.topic).sort());
    expect(topics('assistant')).toEqual(assistantCases.map((c) => c.topic).sort());
    expect(topics('presentations')).toEqual(presentationCases.map((c) => c.topic).sort());
  });

  it('the lesson planner meets its thresholds', async () => {
    const report = await runPlannerEvals(replay('planner'), thresholds['lesson-planner']);
    expect(report.failing, formatReport(report)).toEqual([]);
  });

  it('the AI assistant meets its thresholds', async () => {
    const report = await runAssistantEvals(replay('assistant'), thresholds.assistant);
    expect(report.failing, formatReport(report)).toEqual([]);
  });

  it('the question extractor and the grader have a saved reply for every case', () => {
    expect(Object.keys(loadReplays('extractor'))).toHaveLength(extractorCases.length);
    expect(Object.keys(loadReplays('grader'))).toHaveLength(graderCases.length);
  });

  it('the question extractor meets its thresholds', async () => {
    const report = await runExtractorEvals(replay('extractor'), thresholds['question-extractor']);
    expect(report.failing, formatReport(report)).toEqual([]);
  });

  it('the grader meets its thresholds', async () => {
    const report = await runGraderEvals(replay('grader'), thresholds.grader);
    expect(report.failing, formatReport(report)).toEqual([]);
  });

  it('presentations meet their thresholds', async () => {
    const report = await runPresentationEvals(replay('presentations'), thresholds.presentations);
    expect(report.failing, formatReport(report)).toEqual([]);
  });
});

describe('ReplayLlmClient', () => {
  it('answers with the reply saved for the topic in the prompt', async () => {
    const llm = new ReplayLlmClient({ Fractions: 'saved reply' });
    const request = {
      system: '',
      maxTokens: 1,
      messages: [{ role: 'user' as const, content: 'Topic: Fractions\nGrade: 4' }],
    };
    expect(await llm.complete(request)).toEqual({
      ok: true,
      value: { text: 'saved reply', stopReason: 'end' },
    });
  });

  it('fails as invalid_request when no reply is saved for the prompt', async () => {
    const llm = new ReplayLlmClient({});
    const request = {
      system: '',
      maxTokens: 1,
      messages: [{ role: 'user' as const, content: 'Topic: Other' }],
    };
    expect(await llm.complete(request)).toEqual({ ok: false, error: { code: 'invalid_request' } });
  });
});
