import type { Result } from '@thp/domain';
import type { DraftError, LlmClient, LlmRequest, LlmResponse } from '@thp/ports';

/** Keeps the model's last reply, so a scorecard can see what the agent cleaned up or refused. */
export class Recording implements LlmClient {
  lastReply: LlmResponse = { text: '', stopReason: 'end' };

  constructor(private readonly inner: LlmClient) {}

  async complete(request: LlmRequest) {
    const reply = await this.inner.complete(request);
    this.lastReply = reply.ok ? reply.value : { text: '', stopReason: 'end' };
    return reply;
  }
}

export interface CaseResult<M extends string> {
  readonly name: string;
  readonly scores: Readonly<Record<M, number>>;
  /** Why no result came back, or null when one did. */
  readonly problem: string | null;
}

export interface EvalReport<M extends string> {
  readonly cases: readonly CaseResult<M>[];
  readonly average: Readonly<Record<M, number>>;
  readonly failing: readonly M[];
}

/** Why an agent returned nothing: the model was down, or what the review found in its last reply. */
export function problemOf<T>(
  outcome: Result<T, DraftError>,
  review: () => Result<unknown, string>,
): string | null {
  if (outcome.ok) return null;
  if (outcome.error.code === 'ai_unavailable') return 'the model was unavailable (ai_unavailable)';
  const reviewed = review();
  return reviewed.ok ? outcome.error.code : reviewed.error;
}

const cell = (value: number) => value.toFixed(2).padStart(6);

/** A plain-text table of the scores, one row per case and the average last, then why cases failed. */
export function formatReport<M extends string>(report: EvalReport<M>): string {
  const metrics = Object.keys(report.average) as M[];
  const width = Math.max(...report.cases.map((c) => c.name.length), 'average'.length);
  const row = (name: string, scores: Readonly<Record<M, number>>) =>
    `${name.padEnd(width)} ${metrics.map((m) => cell(scores[m])).join(' ')}`;
  const failed = report.cases.flatMap((c) =>
    c.problem === null ? [] : [`${c.name}: ${c.problem}`],
  );
  return [
    `${''.padEnd(width)} ${metrics.map((m) => m.slice(0, 6).padStart(6)).join(' ')}`,
    ...report.cases.map((c) => row(c.name, c.scores)),
    row('average', report.average),
    report.failing.length === 0
      ? 'All thresholds met.'
      : `Below threshold: ${report.failing.join(', ')}`,
    ...(failed.length === 0 ? [] : ['Failed cases:', ...failed]),
  ].join('\n');
}
