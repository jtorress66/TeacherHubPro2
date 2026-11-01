import {
  averageOf,
  failingMetrics,
  gameMetrics,
  GameWriter,
  reviewGame,
  scoreGame,
  type GameMetric,
} from '@thp/agents';
import { createGameRequest, type GameRequestInput } from '@thp/domain';
import type { LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** One case per content kind, across languages; each topic keys its saved reply. */
export const gameCases: readonly (GameRequestInput & { readonly count: number })[] = [
  {
    kind: 'pairs',
    subject: 'science',
    grade: '4',
    topic: 'The solar system',
    language: 'en',
    count: 6,
  },
  {
    kind: 'questions',
    subject: 'math',
    grade: '5',
    topic: 'Las fracciones',
    language: 'es',
    count: 4,
  },
  {
    kind: 'statements',
    subject: 'science',
    grade: '3',
    topic: 'Les animaux de la ferme',
    language: 'fr',
    count: 4,
  },
  {
    kind: 'sentences',
    subject: 'science',
    grade: '4',
    topic: '水的循环',
    language: 'zh',
    count: 4,
  },
  {
    kind: 'steps',
    subject: 'science',
    grade: '7',
    topic: 'Die Photosynthese',
    language: 'de',
    count: 4,
  },
  {
    kind: 'groups',
    subject: 'science',
    grade: '3',
    topic: 'Animais vertebrados e invertebrados',
    language: 'pt',
    count: 2,
  },
];

export type GameReport = EvalReport<GameMetric>;

export async function runGameEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<GameMetric, number>>,
  cases: typeof gameCases = gameCases,
): Promise<GameReport> {
  const results: CaseResult<GameMetric>[] = [];
  for (const input of cases) {
    const request = createGameRequest(input);
    if (!request.ok) throw new Error(`Invalid eval case ${input.topic}`);
    const recording = new Recording(llm);
    const content = await new GameWriter(recording).write(request.value);
    results.push({
      name: `${input.kind} (${input.language})`,
      scores: scoreGame(request.value, content.ok ? content.value : null),
      problem: problemOf(content, () => reviewGame(request.value, recording.lastReply)),
    });
  }
  const average = averageOf(
    gameMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
