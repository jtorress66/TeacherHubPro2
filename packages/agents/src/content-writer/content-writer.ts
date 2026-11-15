import {
  err,
  ok,
  questionPartSize,
  standardSubjectOf,
  standardsFor,
  type ContentRequest,
  type JobProgress,
  type Result,
} from '@thp/domain';
import type { ContentWriter as ContentWriterPort, DraftError, LlmClient } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { eslGuidance } from '../drafting/esl.ts';
import { languageNames } from '../drafting/language.ts';
import { subjectNames } from '../drafting/subject-names.ts';
import { contentFormats } from './content-formats.ts';
import { reviewContent } from './content-review.ts';
import {
  mergeQuizParts,
  partsOf,
  readQuizPart,
  stemList,
  type PartRange,
  type QuizPart,
} from './quiz-parts.ts';

// Room for the model's thinking as well as the content itself.
const maxTokens = 16000;
const descriptionLength = 160;

export const contentSystemPrompt = `You are an expert teacher and curriculum designer writing classroom material for a teacher.
The teacher reviews and edits everything you write before using it.
Rules:
- Reply in Markdown only: headings, lists, **bold**, and small tables. No HTML and no text before the first heading.
- Write everything in the language the teacher asks for.
- Cite only standards codes from the list you are given, copied exactly. If none fit, or no list is given, cite none.
- Never invent standards codes, grades, test scores, statistics or facts about students.
- Be specific and practical: ready to use in class. Use ___ for blanks students fill in.`;

function standardsLines(request: ContentRequest): string {
  const subject = standardSubjectOf(request);
  const standards = subject === null ? [] : standardsFor(subject, request.grade);
  if (standards.length === 0) return 'Do not cite any standards codes.';
  const lines = standards.map((s) => `${s.code}: ${s.description.slice(0, descriptionLength)}`);
  return `Common Core codes you may cite (at most 3 that fit the topic):\n${lines.join('\n')}`;
}

/** What every request for this type, subject and grade repeats: format, language, standards, ESL. */
function sharedPrefix(request: ContentRequest): string {
  return [
    contentFormats[request.type](request),
    [
      `Write in ${languageNames[request.language]}.`,
      `Subject: ${subjectNames[request.subject]}`,
      `Grade: ${request.grade === 'K' ? 'Kindergarten' : request.grade}`,
    ].join('\n'),
    standardsLines(request),
    ...(request.esl ? [eslGuidance] : []),
  ].join('\n\n');
}

/** This request's topic and settings. */
function details(request: ContentRequest): string {
  return [
    `Topic: ${request.topic}`,
    `Difficulty: ${request.difficulty}`,
    ...(request.durationMinutes === null
      ? []
      : [`Class period: ${String(request.durationMinutes)} minutes`]),
    ...(request.instructions === null ? [] : [`Teacher's instructions: ${request.instructions}`]),
  ].join('\n');
}

/**
 * The prompt in two parts: what every request for this subject and grade repeats first, so it can
 * be cached, then this request's topic and details.
 */
function prompt(request: ContentRequest): { stablePrefix: string; text: string } {
  const stablePrefix = sharedPrefix(request);
  return { stablePrefix, text: `${stablePrefix}\n\n${details(request)}\n` };
}

const partsGuide = [
  `This quiz is long, so it is written in parts of ${String(questionPartSize)} questions, one part per reply.`,
  'In each part, put its questions under the questions heading, numbered exactly as told, then',
  'the answers to those same questions under the answer key heading, with the same numbers.',
  'Every question must be new: never repeat or reword a question from an earlier part.',
].join('\n');

/** One part's request: what all parts share (cacheable), then this part's numbers and the stems so far. */
function partPrompt(
  shared: string,
  range: PartRange,
  index: number,
  count: number,
  stems: readonly string[],
): string {
  const from = String(range.from);
  const to = String(range.to);
  const which = `Write part ${String(index + 1)} of ${String(count)}: questions ${from} to ${to} and their answer key, numbered ${from}. to ${to}.`;
  const lines =
    index === 0
      ? [`${which} Start with the quiz title as a # heading.`]
      : [
          `${which} Do not write a title or anything after the answer key.`,
          'Questions already written (do not repeat them):',
          stemList(stems),
        ];
  return `${shared}\n\n${lines.join('\n')}\n`;
}

/**
 * Writes worksheets, quizzes, summaries, activities and lesson plans as Markdown. It only
 * writes: the teacher reviews and keeps it. It sends only the request (no class or student
 * data) and removes any standards code that is not in the official list.
 */
export class ContentWriter implements ContentWriterPort {
  constructor(private readonly llm: LlmClient) {}

  write(
    request: ContentRequest,
    onProgress?: (progress: JobProgress) => Promise<void>,
  ): Promise<Result<string, DraftError>> {
    const total = request.questionCount ?? 0;
    if (request.type === 'quiz' && total > questionPartSize) {
      return this.writeInParts(request, total, onProgress);
    }
    const { stablePrefix, text } = prompt(request);
    return draftWithReview(this.llm, {
      system: contentSystemPrompt,
      prompt: text,
      stablePrefix,
      maxTokens,
      review: reviewContent,
      retry,
    });
  }

  /**
   * A long quiz, part by part: each part sees the earlier questions' stems and is asked once more
   * when unusable. Any part that still fails fails the whole quiz; it is never cut short.
   */
  private async writeInParts(
    request: ContentRequest,
    total: number,
    onProgress?: (progress: JobProgress) => Promise<void>,
  ): Promise<Result<string, DraftError>> {
    const stablePrefix = [sharedPrefix(request), details(request), partsGuide].join('\n\n');
    const { first, rest } = partsOf(total);
    const count = rest.length + 1;
    const writePart = async (range: PartRange, index: number, stems: readonly string[]) => {
      await onProgress?.({ ...range, total });
      return draftWithReview(this.llm, {
        system: contentSystemPrompt,
        prompt: partPrompt(stablePrefix, range, index, count, stems),
        stablePrefix,
        maxTokens,
        review: (reply) => {
          const content = reviewContent(reply);
          return content.ok ? readQuizPart(content.value, range, stems) : content;
        },
        retry,
      });
    };
    const opening = await writePart(first, 0, []);
    if (!opening.ok) return err(opening.error);
    const later: QuizPart[] = [];
    let stems = opening.value.stems;
    for (const [index, range] of rest.entries()) {
      const part = await writePart(range, index + 1, stems);
      if (!part.ok) return err(part.error);
      later.push(part.value);
      stems = [...stems, ...part.value.stems];
    }
    return ok(mergeQuizParts(opening.value, later));
  }
}

const retry = (problem: string) =>
  `That reply could not be used: ${problem} Write it again in full.`;
