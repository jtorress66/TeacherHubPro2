import {
  averageOf,
  failingMetrics,
  InsightWriter,
  insightMetrics,
  reviewInsight,
  scoreInsight,
  type ExpectedInsight,
  type InsightMetric,
} from '@thp/agents';
import type { InsightRequest, LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Fixed students' numbers (no names, as the app sends them), each with what the insight should raise. */
export const insightCases: readonly ({
  readonly name: string;
  readonly request: InsightRequest;
} & ExpectedInsight)[] = [
  {
    name: 'struggling: falling scores, missing work, absences (en)',
    request: {
      language: 'en',
      stats: {
        average: 54.2,
        attendanceRate: 75,
        absences: 4,
        tardies: 1,
        excused: 0,
        sessions: 16,
        missing: 3,
      },
      recentGrades: [
        { title: 'Fractions quiz', date: '2026-11-02', status: 'graded', percentage: 40 },
        { title: 'Decimals test', date: '2026-10-20', status: 'graded', percentage: 62 },
        { title: 'Ratios homework', date: '2026-10-10', status: 'missing', percentage: 0 },
      ],
      recentAttendance: [
        { date: '2026-11-03', status: 'absent' },
        { date: '2026-10-28', status: 'absent' },
      ],
    },
    mentions: ['missing'],
  },
  {
    name: 'improving: rising scores, good attendance (es)',
    request: {
      language: 'es',
      stats: {
        average: 81,
        attendanceRate: 100,
        absences: 0,
        tardies: 0,
        excused: 0,
        sessions: 12,
        missing: 0,
      },
      recentGrades: [
        { title: 'Volcano report', date: '2026-11-01', status: 'graded', percentage: 92 },
        { title: 'Rocks quiz', date: '2026-10-15', status: 'graded', percentage: 70 },
      ],
      recentAttendance: [],
    },
    mentions: [],
  },
  {
    name: 'little data so far (en)',
    request: {
      language: 'en',
      stats: {
        average: null,
        attendanceRate: 100,
        absences: 0,
        tardies: 0,
        excused: 0,
        sessions: 2,
        missing: 0,
      },
      recentGrades: [{ title: 'Spelling check', date: null, status: 'excused', percentage: null }],
      recentAttendance: [],
    },
    mentions: ['data'],
  },
];

export type InsightReport = EvalReport<InsightMetric>;

export async function runInsightEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<InsightMetric, number>>,
  cases: typeof insightCases = insightCases,
): Promise<InsightReport> {
  const results: CaseResult<InsightMetric>[] = [];
  for (const { name, request, ...expected } of cases) {
    const recording = new Recording(llm);
    const bullets = await new InsightWriter(recording).write(request);
    results.push({
      name,
      scores: scoreInsight(expected, bullets.ok ? bullets.value : null, request),
      problem: problemOf(bullets, () => reviewInsight(recording.lastReply, request)),
    });
  }
  const average = averageOf(
    insightMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
