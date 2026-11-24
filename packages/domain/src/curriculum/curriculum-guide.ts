import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';
import type { Id, JobId, SchoolId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { gradeLevels, isGradeLevel, type GradeLevel } from '../standards/common-core.ts';

export type CurriculumGuideId = Id<'CurriculumGuide'>;

/** A guide uploaded as a file is read in the background; pasted text is ready at once. */
export const curriculumGuideStatuses = ['reading', 'ready', 'failed'] as const;
export type CurriculumGuideStatus = (typeof curriculumGuideStatuses)[number];

export const curriculumGuideFailures = ['unreadable', 'no_text'] as const;
export type CurriculumGuideFailure = (typeof curriculumGuideFailures)[number];

/** The files a guide can come from. A new kind adds an entry here and a reader in the worker. */
export const curriculumFileKinds = ['pdf', 'docx'] as const;
export type CurriculumFileKind = (typeof curriculumFileKinds)[number];

/** Too little text to follow: a heading, or a scan that only gave a page number. */
export const minCurriculumText = 40;
/** The most text a guide keeps (about 80 pages). Pasted text over it is refused. */
export const maxCurriculumText = 200_000;
/** How much of a guide the AI reads with each request: about 10 to 12 pages. */
export const maxCurriculumExcerpt = 24_000;

/**
 * A school's own curriculum for one subject and grade (pacing guide, scope and sequence, unit
 * plans), which the AI follows when a teacher asks it to. School material, never student data.
 * A school has at most one guide per subject and grade.
 */
export interface CurriculumGuide {
  readonly id: CurriculumGuideId;
  readonly schoolId: SchoolId;
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly title: string;
  /** The uploaded file's name; null for pasted text. */
  readonly sourceName: string | null;
  readonly status: CurriculumGuideStatus;
  readonly failure: CurriculumGuideFailure | null;
  /** The job reading the uploaded file; null for pasted text. */
  readonly jobId: JobId | null;
  /** The guide's text, tidied, up to `maxCurriculumText` characters. */
  readonly text: string;
  /** How long the whole text was, before any was left out. */
  readonly totalCharacters: number;
  readonly updatedBy: UserId;
  readonly updatedAt: Date;
}

export interface CurriculumGuideInput {
  readonly id: CurriculumGuideId;
  readonly schoolId: SchoolId;
  readonly subject: string;
  readonly grade: string;
  readonly title: string;
  readonly updatedBy: UserId;
  readonly now: Date;
}

const isAssistantSubject = (value: string): value is AssistantSubject =>
  (assistantSubjects as readonly string[]).includes(value);

/** Windows line ends made plain, spaces trimmed off line ends, at most one blank line in a row. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function newGuide(
  input: CurriculumGuideInput,
): Result<
  Omit<CurriculumGuide, 'sourceName' | 'status' | 'jobId' | 'text' | 'totalCharacters'>,
  ValidationError
> {
  if (!isAssistantSubject(input.subject)) return invalid('subject', 'not_allowed');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'not_allowed');
  const title = requiredText('title', input.title);
  if (!title.ok) return title;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    subject: input.subject,
    grade: input.grade,
    title: title.value,
    failure: null,
    updatedBy: input.updatedBy,
    updatedAt: input.now,
  });
}

/** A guide typed or pasted in: ready at once. */
export function pastedCurriculumGuide(
  input: CurriculumGuideInput & { readonly text: string },
): Result<CurriculumGuide, ValidationError> {
  const guide = newGuide(input);
  if (!guide.ok) return guide;
  const text = tidy(input.text);
  if (text.length < minCurriculumText) return invalid('text', 'too_short');
  if (text.length > maxCurriculumText) return invalid('text', 'too_long');
  return ok({
    ...guide.value,
    sourceName: null,
    status: 'ready',
    jobId: null,
    text,
    totalCharacters: text.length,
  });
}

/** A guide uploaded as a file: waits to be read. */
export function uploadedCurriculumGuide(
  input: CurriculumGuideInput & { readonly sourceName: string },
): Result<CurriculumGuide, ValidationError> {
  const guide = newGuide(input);
  if (!guide.ok) return guide;
  return ok({
    ...guide.value,
    sourceName: input.sourceName,
    status: 'reading',
    jobId: null,
    text: '',
    totalCharacters: 0,
  });
}

/** The job that reads the guide's file; only that job may fill the guide in. */
export const withReadingJob = (guide: CurriculumGuide, jobId: JobId): CurriculumGuide => ({
  ...guide,
  jobId,
});

/** Guides in the order the forms list them: by subject, then by grade. */
export function byCurriculumOrder(a: CurriculumGuide, b: CurriculumGuide): number {
  return (
    assistantSubjects.indexOf(a.subject) - assistantSubjects.indexOf(b.subject) ||
    gradeLevels.indexOf(a.grade) - gradeLevels.indexOf(b.grade)
  );
}

/** The file's text arrived: the guide is ready, or failed when there is too little to follow. */
export function curriculumGuideRead(
  guide: CurriculumGuide,
  fileText: string,
  now: Date,
): CurriculumGuide {
  const text = tidy(fileText);
  if (text.length < minCurriculumText) {
    return { ...guide, status: 'failed', failure: 'no_text', text: '', updatedAt: now };
  }
  return {
    ...guide,
    status: 'ready',
    failure: null,
    text: text.slice(0, maxCurriculumText),
    totalCharacters: text.length,
    updatedAt: now,
  };
}

/** The file could not be read (damaged, locked with a password, or not what its name says). */
export function curriculumGuideUnreadable(guide: CurriculumGuide, now: Date): CurriculumGuide {
  return { ...guide, status: 'failed', failure: 'unreadable', text: '', updatedAt: now };
}

/** The kind of file a name is, from its extension; null for a kind the app cannot read. */
export function curriculumFileKindOf(fileName: string): CurriculumFileKind | null {
  const extension = /\.([a-z0-9]+)$/iu.exec(fileName.trim())?.[1]?.toLowerCase();
  return curriculumFileKinds.find((kind) => kind === extension) ?? null;
}

/**
 * What the AI reads of a guide: all of it, or its first `maxCurriculumExcerpt` characters, cut
 * between words. Nothing from a guide that is not ready.
 */
export function guideExcerpt(guide: CurriculumGuide): string {
  if (guide.status !== 'ready') return '';
  if (guide.text.length <= maxCurriculumExcerpt) return guide.text;
  const cut = guide.text.slice(0, maxCurriculumExcerpt + 1);
  const lastSpace = cut.search(/\s\S*$/u);
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, maxCurriculumExcerpt)).trimEnd();
}

/** How many characters the AI reads, of how many the guide has; shown beside each guide. */
export function guideUsage(guide: CurriculumGuide): { used: number; total: number } {
  if (guide.status !== 'ready') return { used: 0, total: 0 };
  return { used: guideExcerpt(guide).length, total: guide.totalCharacters };
}
