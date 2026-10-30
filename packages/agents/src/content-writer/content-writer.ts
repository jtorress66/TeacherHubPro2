import { standardSubjectOf, standardsFor, type ContentRequest, type Result } from '@thp/domain';
import type { ContentWriter as ContentWriterPort, DraftError, LlmClient } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { languageNames } from '../drafting/language.ts';
import { subjectNames } from '../drafting/subject-names.ts';
import { contentFormats } from './content-formats.ts';
import { reviewContent } from './content-review.ts';

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

function prompt(request: ContentRequest): string {
  return [
    contentFormats[request.type](request),
    [
      `Write in ${languageNames[request.language]}.`,
      `Subject: ${subjectNames[request.subject]}`,
      `Grade: ${request.grade === 'K' ? 'Kindergarten' : request.grade}`,
      `Topic: ${request.topic}`,
      `Difficulty: ${request.difficulty}`,
      ...(request.durationMinutes === null
        ? []
        : [`Class period: ${String(request.durationMinutes)} minutes`]),
      ...(request.instructions === null ? [] : [`Teacher's instructions: ${request.instructions}`]),
    ].join('\n'),
    standardsLines(request),
  ].join('\n\n');
}

/**
 * Writes worksheets, quizzes, summaries, activities and lesson plans as Markdown. It only
 * writes: the teacher reviews and keeps it. It sends only the request (no class or student
 * data) and removes any standards code that is not in the official list.
 */
export class ContentWriter implements ContentWriterPort {
  constructor(private readonly llm: LlmClient) {}

  write(request: ContentRequest): Promise<Result<string, DraftError>> {
    return draftWithReview(this.llm, {
      system: contentSystemPrompt,
      prompt: prompt(request),
      maxTokens,
      review: reviewContent,
      retry: (problem) => `That reply could not be used: ${problem} Write it again in full.`,
    });
  }
}
