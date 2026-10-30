import { describe, expect, it } from 'vitest';
import { LocalLlmClient } from '@thp/adapters';
import { FakeLlmClient } from '@thp/testing';
import { localReply } from '../local-replies.ts';
import { assistantCases, runAssistantEvals } from './assistant-evals.ts';
import { presentationCases, runPresentationEvals } from './presentation-evals.ts';

const local = () => new LocalLlmClient(localReply);

describe('assistant evals', () => {
  const thresholds = { structure: 1, language: 1, validCodes: 1, questionCount: 0.9 };

  it('has valid cases covering every content type and every language', async () => {
    expect(new Set(assistantCases.map((c) => c.type))).toEqual(
      new Set(['lesson_plan', 'quiz', 'summary', 'activities', 'worksheet']),
    );
    expect(new Set(assistantCases.map((c) => c.language))).toEqual(
      new Set(['en', 'es', 'fr', 'pt', 'de', 'it', 'zh']),
    );
    const report = await runAssistantEvals(local(), thresholds);
    expect(report.cases).toHaveLength(assistantCases.length);
  });

  it('scores English cases from the local stand-in as passing', async () => {
    const report = await runAssistantEvals(
      local(),
      thresholds,
      assistantCases.filter((c) => c.language === 'en'),
    );
    expect(report.average).toEqual({ structure: 1, language: 1, validCodes: 1, questionCount: 1 });
    expect(report.failing).toEqual([]);
  });

  it('reports why a case failed', async () => {
    const llm = new FakeLlmClient().replyWith('no heading').replyWith('still none');
    const [first] = assistantCases;
    if (first === undefined) throw new Error('no cases');
    const report = await runAssistantEvals(llm, thresholds, [first]);
    expect(report.cases[0]?.problem).toMatch(/# heading/);
    expect(report.failing).toContain('structure');
  });

  it('refuses an invalid case', async () => {
    await expect(
      runAssistantEvals(local(), thresholds, [
        { name: 'bad', type: 'essay', subject: 'math', grade: '4', topic: 'x', language: 'en' },
      ]),
    ).rejects.toThrow('Eval case "bad" is invalid: type');
  });
});

describe('presentation evals', () => {
  const thresholds = { structure: 1, language: 1, slideCount: 1, titles: 1 };

  it('has valid cases in several languages and scores the local stand-in', async () => {
    expect(presentationCases.length).toBeGreaterThanOrEqual(4);
    const report = await runPresentationEvals(
      local(),
      thresholds,
      presentationCases.filter((c) => c.language === 'en'),
    );
    expect(report.average).toEqual({ structure: 1, language: 1, slideCount: 1, titles: 1 });
  });

  it('reports why a case failed, and refuses an invalid case', async () => {
    const llm = new FakeLlmClient().replyWith('nope').replyWith('nope');
    const [first] = presentationCases;
    if (first === undefined) throw new Error('no cases');
    const report = await runPresentationEvals(llm, thresholds, [first]);
    expect(report.cases[0]?.problem).toMatch(/not one JSON object/);

    await expect(
      runPresentationEvals(local(), thresholds, [
        { name: 'bad', topic: 'x', subject: 'math', grade: '4', slideCount: 99, language: 'en' },
      ]),
    ).rejects.toThrow('Eval case "bad" is invalid: slideCount');
  });
});
