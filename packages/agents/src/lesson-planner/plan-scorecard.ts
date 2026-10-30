import type { DraftRequest, LessonPlanDraft } from '@thp/domain';
import { detectLanguage } from '../drafting/language.ts';
import { averageOf, failingMetrics } from '../drafting/scores.ts';
import { parseJsonObject, texts } from '../drafting/json-reply.ts';
import { allowedStandards } from './plan-formats.ts';

/** Each metric is a score from 0 to 1 for one eval case. */
export interface PlanScores {
  /** The planner returned a usable draft. */
  readonly structure: number;
  /** The draft's text is in the requested language. */
  readonly language: number;
  /** Share of the codes the model cited that are on the official list for the subject and grade. */
  readonly validCodes: number;
  /** Every part of the plan is filled in. */
  readonly complete: number;
  /** It cites codes when some fit, and none when the list is empty. */
  readonly relevantCodes: number;
}

export type PlanMetric = keyof PlanScores;

/** All the prose a draft holds, for the language check. */
export function draftText(draft: LessonPlanDraft): string {
  if (draft.kind === 'conversational_english') {
    return [draft.learningObjectives, draft.hook, draft.learningGoal, draft.closure, draft.notes]
      .filter(Boolean)
      .join('\n');
  }
  return [draft.objective, ...draft.days.flatMap((day) => [day.theme, day.notes])]
    .filter(Boolean)
    .join('\n');
}

function isComplete(draft: LessonPlanDraft): boolean {
  if (draft.kind === 'conversational_english') {
    return [draft.learningObjectives, draft.hook, draft.closure, draft.notes].every(Boolean);
  }
  return draft.days.every((day) => Boolean(day.theme) && Boolean(day.notes));
}

/** Scores one eval case from the request, the planner's result and the model's raw reply. */
export function scorePlan(
  request: DraftRequest,
  draft: LessonPlanDraft | null,
  rawReply: string,
): PlanScores {
  const cited = texts(parseJsonObject(rawReply)?.standards);
  const official = new Set(allowedStandards(request).map((s) => s.code));
  const validCodes =
    cited.length === 0 ? 1 : cited.filter((code) => official.has(code)).length / cited.length;
  const relevantCodes = official.size === 0 ? cited.length === 0 : cited.length > 0;

  if (draft === null) {
    return { structure: 0, language: 0, validCodes, complete: 0, relevantCodes: 0 };
  }
  return {
    structure: 1,
    language: detectLanguage(draftText(draft)) === request.language ? 1 : 0,
    validCodes,
    complete: isComplete(draft) ? 1 : 0,
    relevantCodes: request.kind === 'weekly' && !relevantCodes ? 0 : 1,
  };
}

const planMetrics: readonly PlanMetric[] = [
  'structure',
  'language',
  'validCodes',
  'complete',
  'relevantCodes',
];

/** The mean of each metric over all cases. */
export const averageScores = (scores: readonly PlanScores[]): PlanScores =>
  averageOf(planMetrics, scores);

/** The metrics below their threshold. */
export const belowThreshold = (
  scores: PlanScores,
  thresholds: Readonly<Record<PlanMetric, number>>,
): PlanMetric[] => failingMetrics(scores, thresholds);

export { detectLanguage };
