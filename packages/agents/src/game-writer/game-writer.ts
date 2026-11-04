import {
  err,
  findStandard,
  ok,
  validateContent,
  type GameContent,
  type GameRequest,
  type Result,
} from '@thp/domain';
import type { DraftError, GameWriter as GameWriterPort, LlmClient, LlmResponse } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { parseJsonObject } from '../drafting/json-reply.ts';
import { languageNames } from '../drafting/language.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';
import { subjectNames } from '../drafting/subject-names.ts';
import { gameFormats, wordingFor } from './game-formats.ts';

const maxTokens = 6000;

export const gameWriterSystemPrompt = `You write content for educational games played by school children.
The teacher reviews and edits everything before students see it.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- Every item is factually correct, age-appropriate and about the topic. Never invent facts.
- Each item is complete and specific: never write placeholders such as "TODO", "Option A" or "lorem ipsum".
- Items are all different from each other.
- Never mention real people's private details or any student.`;

/** The standard to align with, in its official words (only real Common Core codes reach here). */
function standardLine(request: GameRequest): string[] {
  const standard = request.standard === null ? null : findStandard(request.standard);
  return standard === null
    ? []
    : [`Align every item with the Common Core standard ${standard.code}: ${standard.description}`];
}

function prompt(request: GameRequest): string {
  const format = gameFormats[request.kind];
  return [
    `Write ${String(request.count)} ${format.ask}.`,
    `Subject: ${subjectNames[request.subject]}. Grade: ${request.grade}. Topic: ${request.topic}.`,
    `Difficulty: ${request.difficulty}.`,
    ...standardLine(request),
    `Use ${wordingFor(request.grade)}.`,
    `Write everything in ${languageNames[request.language]}.`,
    ...(request.avoid.length > 0 ? [`Do not repeat these items: ${request.avoid.join('; ')}`] : []),
    `Reply with JSON in this shape:\n${format.shape}`,
  ].join('\n\n');
}

/** The game content, or what is wrong with it in plain words. */
export function reviewGame(request: GameRequest, reply: LlmResponse): Result<GameContent, string> {
  if (reply.stopReason === 'max_tokens') return err('The reply was cut off; keep items shorter.');
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const read = gameFormats[request.kind].read(json.items);
  if (read.items.length < request.count) {
    return err(`Write ${String(request.count)} items; there were ${String(read.items.length)}.`);
  }
  const content = validateContent({
    ...read,
    items: read.items.slice(0, request.count),
  } as GameContent);
  return content.ok ? ok(content.value) : err(ruleBroken(content.error));
}

/**
 * Writes the content of a game (questions, pairs, steps, …) for the teacher to review. It is
 * sent the topic, subject, grade and language only: never a class or student.
 */
export class GameWriter implements GameWriterPort {
  constructor(private readonly llm: LlmClient) {}

  write(request: GameRequest): Promise<Result<GameContent, DraftError>> {
    return draftWithReview(this.llm, {
      system: gameWriterSystemPrompt,
      prompt: prompt(request),
      maxTokens,
      review: (reply) => reviewGame(request, reply),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
