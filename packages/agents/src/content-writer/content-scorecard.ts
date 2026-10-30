import { standardSubjectOf, standardsFor, type ContentRequest } from '@thp/domain';
import { detectLanguage } from '../drafting/language.ts';

export const contentMetrics = ['structure', 'language', 'validCodes', 'questionCount'] as const;
export type ContentMetric = (typeof contentMetrics)[number];
export type ContentScores = Readonly<Record<ContentMetric, number>>;

const codePattern = /CCSS\.[A-Za-z0-9.-]*[A-Za-z0-9]/g;
const numbered = /^\s{0,3}\d+[.)]\s+\S/;

/** Numbered items in the Questions section (or anywhere, when there is no such heading). */
export function countQuestions(markdown: string): number {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^#{1,3}\s+.*question/i.test(line));
  const from = start === -1 ? lines : lines.slice(start + 1);
  const end = from.findIndex((line) => /^#{1,3}\s/.test(line));
  const section = start === -1 || end === -1 ? from : from.slice(0, end);
  return section.filter((line) => numbered.test(line)).length;
}

/** Scores one eval case from the request, the writer's result and the model's raw reply. */
export function scoreContent(
  request: ContentRequest,
  content: string | null,
  rawReply: string,
): ContentScores {
  const cited = rawReply.match(codePattern) ?? [];
  const subject = standardSubjectOf(request);
  const official = new Set(
    subject === null ? [] : standardsFor(subject, request.grade).map((s) => s.code),
  );
  const validCodes =
    cited.length === 0 ? 1 : cited.filter((code) => official.has(code)).length / cited.length;
  if (content === null) return { structure: 0, language: 0, validCodes, questionCount: 0 };
  const questionsMatch =
    request.questionCount === null || countQuestions(content) === request.questionCount;
  return {
    structure: 1,
    language: detectLanguage(content) === request.language ? 1 : 0,
    validCodes,
    questionCount: questionsMatch ? 1 : 0,
  };
}
