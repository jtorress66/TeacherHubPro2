import {
  createRubric,
  err,
  ok,
  type Result,
  type RubricDraft,
  type RubricId,
  type RubricRequest,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { DraftError, LlmClient, LlmResponse, RubricDrafter } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { eslGuidance } from '../drafting/esl.ts';
import { objects, parseJsonObject, text, type Json } from '../drafting/json-reply.ts';
import { languageNames } from '../drafting/language.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';
import { subjectNames } from '../drafting/subject-names.ts';

const maxTokens = 8000;

export const rubricSystemPrompt = `You write clear, fair classroom rubrics for teachers.
The teacher reviews and edits every rubric before using it.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- Write every text value in the language the teacher asks for.
- Each criterion assesses one observable skill; descriptors say what the work shows at that level, in words students understand.
- Levels go from the highest to the lowest; points go down from level to level.
- Never invent standards codes, grades or facts about students.`;

const shape = (request: RubricRequest) => `{
  "title": string (at most 120 characters),
  "levels": [exactly ${String(request.levelCount)} objects, highest first: {
    "label": string (at most 60 characters),
    "points": whole number from 0 to 100, lower than the level before
  }],
  "criteria": [exactly ${String(request.criteriaCount)} objects: {
    "name": string (at most 120 characters),
    "descriptors": [exactly ${String(request.levelCount)} strings, one per level in the same order, each at most 500 characters]
  }]
}`;

function prompt(request: RubricRequest): string {
  return [
    `Create a rubric with exactly ${String(request.criteriaCount)} criteria and exactly ${String(request.levelCount)} levels.`,
    [
      `Write in ${languageNames[request.language]}.`,
      ...(request.subject === null ? [] : [`Subject: ${subjectNames[request.subject]}`]),
      ...(request.grade === null
        ? []
        : [`Grade: ${request.grade === 'K' ? 'Kindergarten' : request.grade}`]),
      `What to assess: ${request.topic}`,
      ...(request.instructions === null ? [] : [`Teacher's instructions: ${request.instructions}`]),
    ].join('\n'),
    ...(request.esl ? [eslGuidance] : []),
    `Reply with JSON in this shape:\n${shape(request)}`,
  ].join('\n\n');
}

const descriptors = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : '')) : [];

const levelFrom = (json: Json) => ({
  label: text(json.label) ?? '',
  points: typeof json.points === 'number' ? json.points : -1,
});

const criterionFrom = (json: Json) => ({
  name: text(json.name) ?? '',
  descriptors: descriptors(json.descriptors),
});

/** The rubric in a reply, or what is wrong with it in plain words. */
export function reviewRubric(
  request: RubricRequest,
  reply: LlmResponse,
): Result<RubricDraft, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; keep the descriptors shorter.');
  }
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const levels = objects(json.levels).map(levelFrom);
  if (levels.length !== request.levelCount) {
    return err(`Return exactly ${String(request.levelCount)} levels in "levels".`);
  }
  const criteria = objects(json.criteria).map(criterionFrom);
  if (criteria.length !== request.criteriaCount) {
    return err(`Return exactly ${String(request.criteriaCount)} criteria in "criteria".`);
  }
  const title = request.title ?? text(json.title) ?? request.topic;
  const checked = createRubric({
    id: 'draft' as RubricId,
    schoolId: 'draft' as SchoolId,
    teacherId: 'draft' as UserId,
    title,
    levels,
    criteria,
    now: new Date(0),
  });
  return checked.ok
    ? ok({
        title: checked.value.title,
        levels: checked.value.levels,
        criteria: checked.value.criteria,
      })
    : err(ruleBroken(checked.error));
}

/** Drafts a rubric for a topic. It only drafts: the teacher edits and saves the rubric. */
export class RubricWriter implements RubricDrafter {
  constructor(private readonly llm: LlmClient) {}

  draft(request: RubricRequest): Promise<Result<RubricDraft, DraftError>> {
    return draftWithReview(this.llm, {
      system: rubricSystemPrompt,
      prompt: prompt(request),
      maxTokens,
      review: (reply) => reviewRubric(request, reply),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
