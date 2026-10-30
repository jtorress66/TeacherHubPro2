import { describe, expect, it } from 'vitest';
import { LocalLlmClient } from '@thp/adapters';
import { FakeLlmClient } from '@thp/testing';
import { localPlannerReply } from '../local-planner-reply.ts';
import { formatReport, plannerCases, runPlannerEvals } from './planner-evals.ts';

const thresholds = { structure: 1, language: 1, validCodes: 1, complete: 1, relevantCodes: 0.8 };

describe('runPlannerEvals', () => {
  it('has valid cases covering every interface language', async () => {
    expect(new Set(plannerCases.map((c) => c.language))).toEqual(
      new Set(['en', 'es', 'fr', 'pt', 'de', 'it', 'zh']),
    );
    const report = await runPlannerEvals(new LocalLlmClient(localPlannerReply), thresholds);
    expect(report.cases).toHaveLength(plannerCases.length);
  });

  it('scores each case and averages them; English-only replies fail the language bar', async () => {
    const report = await runPlannerEvals(
      new LocalLlmClient(localPlannerReply),
      thresholds,
      plannerCases.filter((c) => c.language === 'en' || c.language === 'es'),
    );

    expect(report.cases.find((c) => c.name === 'math grade 4 (en)')?.scores).toEqual({
      structure: 1,
      language: 1,
      validCodes: 1,
      complete: 1,
      relevantCodes: 1,
    });
    expect(report.average.language).toBeLessThan(1);
    expect(report.failing).toContain('language');
    expect(formatReport(report)).toMatch(/average .*\nBelow threshold: language/);
  });

  it('scores a model that is down as failing every case', async () => {
    const llm = new FakeLlmClient().failWith('unavailable');
    const [first] = plannerCases;
    if (first === undefined) throw new Error('no cases');
    const report = await runPlannerEvals(llm, thresholds, [first]);

    expect(report.average.structure).toBe(0);
    expect(formatReport(report)).toContain('Below threshold: structure');
    expect(formatReport(report)).toContain(
      `${first.name}: the model was unavailable (ai_unavailable)`,
    );
  });

  it('says why a case failed when the reply could not be used', async () => {
    const llm = new FakeLlmClient().replyWith('No JSON here').replyWith('Still none');
    const [first] = plannerCases;
    if (first === undefined) throw new Error('no cases');
    const report = await runPlannerEvals(llm, thresholds, [first]);

    expect(report.cases[0]?.problem).toMatch(/not one JSON object/);
    expect(formatReport(report)).toMatch(
      /Failed cases:\n.*math grade 4 \(en\): .*not one JSON object/,
    );
  });

  it('reports a clean run', async () => {
    const report = await runPlannerEvals(
      new LocalLlmClient(localPlannerReply),
      thresholds,
      plannerCases.filter((c) => c.name === 'math grade 4 (en)'),
    );
    expect(formatReport(report)).toContain('All thresholds met.');
  });

  it('refuses an invalid case', async () => {
    await expect(
      runPlannerEvals(new LocalLlmClient(localPlannerReply), thresholds, [
        {
          name: 'bad',
          kind: 'weekly',
          subject: 'math',
          grade: '13',
          topic: 'x',
          language: 'en',
          start: '2026-09-07',
        },
      ]),
    ).rejects.toThrow('Eval case "bad" is invalid: grade');
  });
});
