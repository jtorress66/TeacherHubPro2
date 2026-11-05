import {
  err,
  maxInsightBulletLength,
  maxInsightBullets,
  minInsightBullets,
  ok,
  type Result,
} from '@thp/domain';
import type {
  DraftError,
  InsightRequest,
  InsightWriter as InsightWriterPort,
  LlmClient,
  LlmResponse,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { parseJsonObject, texts } from '../drafting/json-reply.ts';
import { languageNames } from '../drafting/language.ts';

const maxTokens = 1500;
/** A percentage this close to one in the data is the same number, rounded. */
const roundingTolerance = 1;

export const insightSystemPrompt = `You are a concise instructional coach. You read one student's classroom numbers and write a short insight for their teacher.
The teacher reads it as a draft and decides what to do; families never see it.
Rules:
1. Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
2. Write 3 to 5 short bullets: trends (improving or declining), attendance patterns, risk flags, and 1 or 2 concrete next steps for the teacher.
3. Use only the numbers you are given. Never invent grades, percentages, attendance or events.
4. When there is little data, say so in one bullet instead of guessing.
5. Refer to "the student"; you are never told their name.`;

/** The same for every request, so it goes first and may be cached. */
const stablePrefix = `Reply with JSON in this shape:
{ "bullets": [string, string, string] } (3 to 5 bullets, each under ${String(maxInsightBulletLength)} characters)

`;

const percentages = (text: string): string[] =>
  [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((match) => match[1] ?? '');

/** Percentages the bullets give that are not in the data, allowing for rounding. */
export function inventedPercentages(bullets: readonly string[], request: InsightRequest): string[] {
  const known = [
    request.stats.average,
    request.stats.attendanceRate,
    ...request.recentGrades.map((grade) => grade.percentage),
  ].filter((value): value is number => value !== null);
  return bullets
    .flatMap(percentages)
    .filter((value) => {
      const number = Number(value.replace(',', '.'));
      return !known.some((k) => Math.abs(k - number) <= roundingTolerance);
    })
    .map((value) => `${value}%`);
}

/** The bullets in a reply, or what is wrong with it in plain words. */
export function reviewInsight(
  reply: LlmResponse,
  request: InsightRequest,
): Result<readonly string[], string> {
  if (reply.stopReason === 'max_tokens')
    return err('The reply was cut off; write shorter bullets.');
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const bullets = texts(json.bullets);
  if (bullets.length < minInsightBullets || bullets.length > maxInsightBullets) {
    return err(
      `Write ${String(minInsightBullets)} to ${String(maxInsightBullets)} bullets, not ${String(bullets.length)}.`,
    );
  }
  if (bullets.some((bullet) => bullet.length > maxInsightBulletLength)) {
    return err(`Keep each bullet under ${String(maxInsightBulletLength)} characters.`);
  }
  const invented = inventedPercentages(bullets, request);
  if (invented.length > 0) {
    return err(
      `These percentages are not in the data: ${invented.join(', ')}. Use only the numbers given.`,
    );
  }
  return ok(bullets);
}

/**
 * Drafts a short insight on one student's trends for their teacher. It is sent numbers and
 * assignment titles only (never a name, accommodations or notes), and may not invent numbers.
 */
export class InsightWriter implements InsightWriterPort {
  constructor(private readonly llm: LlmClient) {}

  write(request: InsightRequest): Promise<Result<readonly string[], DraftError>> {
    const data = JSON.stringify({
      stats: request.stats,
      recentGrades: request.recentGrades,
      recentAttendance: request.recentAttendance,
    });
    return draftWithReview(this.llm, {
      system: insightSystemPrompt,
      prompt: `${stablePrefix}Write in ${languageNames[request.language]}.\n\nThe student's data:\n${data}`,
      stablePrefix,
      maxTokens,
      review: (reply) => reviewInsight(reply, request),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
