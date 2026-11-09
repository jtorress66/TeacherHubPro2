import {
  err,
  learningLevels,
  lessonMinutesRange,
  ok,
  validatePathDraft,
  type LearningLesson,
  type PathDraft,
  type PathRequest,
  type Result,
} from '@thp/domain';
import type { DraftError, LlmClient, LlmResponse, PathWriter as PathWriterPort } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { objects, parseJsonObject, text, texts, type Json } from '../drafting/json-reply.ts';
import { eslGuidance } from '../drafting/esl.ts';
import { languageNames } from '../drafting/language.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';
import { subjectNames } from '../drafting/subject-names.ts';
import { wordingFor } from '../game-writer/game-formats.ts';

const maxTokens = 12_000;

export const pathWriterSystemPrompt = `You design short personal learning paths for one school student working on their own.
The teacher reviews and edits every path before the student sees it.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- Lessons build on each other, from what the student needs to review towards the new objective.
- Everything is factually correct and age-appropriate. Never invent facts.
- Never write placeholders such as "TODO", "Option A" or "lorem ipsum".
- Never mention real people's private details or any student.`;

/**
 * The same for every request, so it goes first and may be cached: the shape and the lesson rules.
 * Only what follows it changes from one request to the next.
 */
const stablePrefix = `Each lesson has a short reading the student can do alone, then 3 to 5 multiple-choice check questions about that reading, each with 2 to 4 short options and exactly one right answer.
Each lesson takes ${String(lessonMinutesRange.min)} to ${String(lessonMinutesRange.max)} minutes. Keep each reading under 1,500 characters.

Reply with JSON in this shape:
{ "title": string, "description": string (one sentence), "lessons": [ { "title": string, "objective": string (what the student will be able to do), "minutes": number, "content": string (the reading), "checks": [ { "prompt": string, "options": [string, ...], "correct": string (copied exactly from options) } ] } ] }

`;

/** What each level asks of the writer. */
const levelWords: Readonly<Record<number, string>> = {
  1: 'rebuild the foundations, below grade level',
  2: 'a little below grade level, with extra support',
  3: 'on grade level',
  4: 'a little above grade level',
  5: 'a challenge well above grade level',
};

function prompt(request: PathRequest): string {
  const topic = request.topic ?? 'the next step in this subject for this grade';
  return [
    stablePrefix + `Write ${String(request.lessonCount)} lessons.`,
    `Subject: ${subjectNames[request.subject]}. Grade: ${request.grade}.`,
    `Topic: ${topic}\n`,
    `Level ${String(request.level)} of ${String(learningLevels.max)}: ${levelWords[request.level] ?? 'on grade level'}.`,
    ...(request.review.length > 0 ? [`Review first: ${request.review.join('; ')}`] : []),
    ...(request.mastered.length > 0
      ? [`Already mastered (build on it, do not repeat): ${request.mastered.join('; ')}`]
      : []),
    `Use ${wordingFor(request.grade)}.`,
    `Write everything in ${languageNames[request.language]}.`,
    ...(request.esl ?[`\n${eslGuidance}`] : []),
  ].join('\n');
}

const str = (value: unknown): string => text(value) ?? '';

function readLesson(lesson: Json): LearningLesson {
  return {
    title: str(lesson.title),
    objective: str(lesson.objective),
    minutes: typeof lesson.minutes === 'number' ? Math.round(lesson.minutes) : 0,
    content: str(lesson.content),
    checks: objects(lesson.checks).map((check) => {
      const options = texts(check.options);
      return { prompt: str(check.prompt), options, answer: options.indexOf(str(check.correct)) };
    }),
  };
}

/** The path, or what is wrong with it in plain words. */
export function reviewPath(request: PathRequest, reply: LlmResponse): Result<PathDraft, string> {
  if (reply.stopReason === 'max_tokens')
    return err('The reply was cut off; keep readings shorter.');
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const lessons = objects(json.lessons).map(readLesson);
  if (lessons.length < request.lessonCount) {
    return err(
      `Write ${String(request.lessonCount)} lessons; there were ${String(lessons.length)}.`,
    );
  }
  const draft = validatePathDraft({
    title: str(json.title),
    description: str(json.description),
    lessons: lessons.slice(0, request.lessonCount),
  });
  return draft.ok ? ok(draft.value) : err(ruleBroken(draft.error));
}

/**
 * Drafts a learning path for the teacher to review. It is sent the subject, grade, language,
 * level and the objectives to review or already mastered: never the student's name or any ID.
 */
export class PathWriter implements PathWriterPort {
  constructor(private readonly llm: LlmClient) {}

  write(request: PathRequest): Promise<Result<PathDraft, DraftError>> {
    return draftWithReview(this.llm, {
      system: pathWriterSystemPrompt,
      prompt: prompt(request),
      stablePrefix,
      maxTokens,
      review: (reply) => reviewPath(request, reply),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
