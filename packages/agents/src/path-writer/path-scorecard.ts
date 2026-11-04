import type { PathDraft, PathRequest } from '@thp/domain';
import { detectLanguage } from '../drafting/language.ts';

export const pathMetrics = ['structure', 'count', 'language', 'playable', 'focus'] as const;
export type PathMetric = (typeof pathMetrics)[number];
export type PathScores = Readonly<Record<PathMetric, number>>;

const words = (text: string): string[] =>
  text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 3);

/** Whether the path takes up an objective to review: most of its longer words appear. */
function covers(path: string, objective: string): boolean {
  const wanted = words(objective);
  if (wanted.length === 0) return true;
  const found = wanted.filter((word) => path.includes(word)).length;
  return found / wanted.length >= 0.5;
}

/**
 * Scores one eval case: a usable path with the lessons asked for, in the requested language,
 * every check answerable (answer among the options), and the objectives to review taken up.
 */
export function scorePath(request: PathRequest, draft: PathDraft | null): PathScores {
  if (draft === null) return { structure: 0, count: 0, language: 0, playable: 0, focus: 0 };
  const checks = draft.lessons.flatMap((lesson) => lesson.checks);
  const answerable = checks.filter((c) => c.answer >= 0 && c.answer < c.options.length).length;
  const prose = draft.lessons.map((l) => `${l.title} ${l.objective} ${l.content}`).join('\n');
  const all = prose.toLocaleLowerCase();
  const reviewed = request.review.filter((objective) => covers(all, objective)).length;
  return {
    structure: 1,
    count: draft.lessons.length === request.lessonCount ? 1 : 0,
    language: detectLanguage(prose) === request.language ? 1 : 0,
    playable: checks.length === 0 ? 0 : answerable / checks.length,
    focus: request.review.length === 0 ? 1 : reviewed / request.review.length,
  };
}
