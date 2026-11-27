import {
  err,
  isPlaceholder,
  maxItemTextLength,
  ok,
  sameAnswer,
  type Result,
} from '@thp/domain';
import type {
  DraftError,
  ExplanationRequest,
  ExplanationWriter as ExplanationWriterPort,
  LlmClient,
  LlmResponse,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { parseJsonObject } from '../drafting/json-reply.ts';
import { languageEvidence, languageNames } from '../drafting/language.ts';

const maxTokens = 4000;

export const explanationSystemPrompt = `You explain the answers of educational game questions to school children.
Each explanation is shown to a student who chose a wrong answer, after the round. The teacher reviews and edits every explanation before students see it.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- One short sentence per item saying why the right answer is right, in plain words a child can follow.
- Never just repeat the answer, and never say the student was wrong or right.
- Never invent facts. Never mention any person's private details or any student.`;

/** The same for every request, so it goes first and may be cached. */
const stablePrefix = `Reply with JSON in this shape:
{ "explanations": [string, ...] } (one per item, in the same order as the items)

Each item gives the question, its options when it has them, and the right answer. For a true-or-false statement the answer is "true" or "false".

`;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** One sentence per item, in order, or what is wrong with the reply in plain words. */
export function reviewExplanations(
  reply: LlmResponse,
  request: ExplanationRequest,
): Result<string[], string> {
  if (reply.stopReason === 'max_tokens') return err('The reply was cut off; keep them shorter.');
  const json = parseJsonObject(reply.text);
  const list = json === null ? null : json.explanations;
  if (!Array.isArray(list)) return err('The reply was not one JSON object with "explanations".');
  const expected = request.items.length;
  if (list.length !== expected) {
    return err(
      `Write exactly ${String(expected)} explanations, one per item, in the same order; there were ${String(list.length)}.`,
    );
  }
  const explanations = list.map(asText);
  for (const [index, explanation] of explanations.entries()) {
    const number = String(index + 1);
    if (explanation === '' || explanation.length > maxItemTextLength || isPlaceholder(explanation)) {
      return err(`Explanation ${number} must be one complete sentence of at most 300 characters.`);
    }
    if (sameAnswer(explanation, request.items[index]?.answer ?? '')) {
      return err(`Explanation ${number} only repeats the answer; say why it is right.`);
    }
  }
  const evidence = languageEvidence(explanations.join('\n'));
  if (evidence.hits > 0 && evidence.language !== request.language) {
    return err(`Write the explanations in ${languageNames[request.language]}.`);
  }
  return ok(explanations);
}

/**
 * Drafts "why this is the answer" sentences for a teacher's game items. It is sent each item's
 * question, options and right answer and the game's language only: never a class or student.
 */
export class ExplanationWriter implements ExplanationWriterPort {
  constructor(private readonly llm: LlmClient) {}

  explain(request: ExplanationRequest): Promise<Result<readonly string[], DraftError>> {
    const items = request.items.map(({ question, options, answer }) => ({
      question,
      ...(options === undefined ? {} : { options }),
      answer,
    }));
    return draftWithReview(this.llm, {
      system: explanationSystemPrompt,
      prompt: `${stablePrefix}Write in ${languageNames[request.language]}.\n\nThe items:\n${JSON.stringify(items)}`,
      stablePrefix,
      maxTokens,
      review: (reply) => reviewExplanations(reply, request),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
