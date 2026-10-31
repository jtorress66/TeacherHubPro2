import type { AiScores, Language } from '@thp/domain';
import { detectLanguage } from '../drafting/language.ts';

export const graderMetrics = ['structure', 'band', 'language'] as const;
export type GraderMetric = (typeof graderMetrics)[number];
export type GraderScores = Readonly<Record<GraderMetric, number>>;

/** The share of a question's points a fair grader would give, as [lowest, highest]. */
export type ScoreBands = Readonly<Record<string, readonly [number, number]>>;

/** Scores one eval case: every score in its expected band, feedback in the requested language. */
export function scoreGrading(
  request: {
    readonly language: Language;
    readonly questions: readonly { readonly id: string; readonly points: number }[];
  },
  bands: ScoreBands,
  graded: AiScores | null,
): GraderScores {
  if (graded === null) return { structure: 0, band: 0, language: 0 };
  const inBand = request.questions.filter((question) => {
    const band = bands[question.id];
    const score = graded.scores[question.id]?.score;
    if (band === undefined || score === undefined) return false;
    const share = score / question.points;
    return share >= band[0] && share <= band[1];
  }).length;
  const feedback = [graded.feedback, ...Object.values(graded.scores).map((s) => s.feedback)].join(
    '\n',
  );
  return {
    structure: 1,
    band: request.questions.length === 0 ? 1 : inBand / request.questions.length,
    language: detectLanguage(feedback) === request.language ? 1 : 0,
  };
}
