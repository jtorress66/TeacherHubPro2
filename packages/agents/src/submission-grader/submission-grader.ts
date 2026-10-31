import { err, ok, type AiScores, type GradingRequest, type Result } from '@thp/domain';
import type {
  DraftError,
  LlmClient,
  LlmResponse,
  SubmissionGrader as SubmissionGraderPort,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { parseJsonObject, text, type Json } from '../drafting/json-reply.ts';
import { languageNames } from '../drafting/language.ts';

const maxTokens = 8000;

export const graderSystemPrompt = `You are an experienced, encouraging teacher suggesting scores for students' written answers.
Your scores are drafts that the teacher reviews and confirms before they count.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- Score each answer from 0 to its points, in steps of 0.5. Use the model answer or rubric when one is given.
- Feedback is short, specific and kind: what the student did well, then one thing to improve.
- Judge only what is written. Never guess who the student is or invent facts about them.`;

const shape = `{
  "scores": { "<question id>": { "score": number, "feedback": string (at most 500 characters) } },
  "feedback": string (one or two encouraging sentences about the whole submission)
}`;

function prompt(request: GradingRequest): string {
  const { leniency } = request.leniency;
  return [
    'Suggest a score and feedback for each answer below.',
    [
      `Write the feedback in ${languageNames[request.language]}.`,
      `Leniency: ${leniency.replace('_', ' ')}. Focus: ${request.leniency.focus}.`,
      request.leniency.spellingMatters
        ? 'Spelling counts a little.'
        : 'Be lenient with spelling for this grade.',
    ].join('\n'),
    `Answers (JSON):\n${JSON.stringify(request.questions, null, 2)}`,
    `Reply with JSON in this shape:\n${shape}`,
  ].join('\n\n');
}

const scoreOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** The suggested scores, or what is wrong with them in plain words. */
export function reviewScores(
  request: GradingRequest,
  reply: LlmResponse,
): Result<AiScores, string> {
  if (reply.stopReason === 'max_tokens')
    return err('The reply was cut off; keep feedback shorter.');
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const given = (
    typeof json.scores === 'object' && json.scores !== null ? json.scores : {}
  ) as Json;
  const scores: Record<string, { score: number; feedback: string }> = {};
  for (const question of request.questions) {
    const entry = given[question.id];
    if (typeof entry !== 'object' || entry === null) {
      return err(`Score every question: "${question.id}" is missing.`);
    }
    const score = scoreOf((entry as Json).score);
    if (score === null || score < 0 || score > question.points) {
      return err(
        `The score for "${question.id}" must be between 0 and ${String(question.points)}.`,
      );
    }
    scores[question.id] = { score, feedback: text((entry as Json).feedback) ?? '' };
  }
  return ok({ scores, feedback: text(json.feedback) ?? '' });
}

/**
 * Suggests scores and feedback for short answers and essays. It only suggests: the teacher
 * confirms every grade. It is sent the answers and their guides only, never who wrote them.
 */
export class SubmissionGrader implements SubmissionGraderPort {
  constructor(private readonly llm: LlmClient) {}

  grade(request: GradingRequest): Promise<Result<AiScores, DraftError>> {
    return draftWithReview(this.llm, {
      system: graderSystemPrompt,
      prompt: prompt(request),
      maxTokens,
      review: (reply) => reviewScores(request, reply),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
