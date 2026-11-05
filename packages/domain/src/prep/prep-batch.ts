import type { ExtractedTest } from '../assignments/extracted-test.ts';
import type { WeeklyDraft } from '../lesson-plans/plan-draft.ts';
import { planWeekdays } from '../lesson-plans/weekly-plan.ts';
import type { PresentationDraft } from '../presentations/presentation-request.ts';
import type {
  AssignmentId,
  ClassId,
  GenerationId,
  JobId,
  LessonPlanId,
  PrepBatchId,
  PresentationId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { checkParentEmail, parentEmailDraft, type ParentEmail } from './parent-email.ts';
import type { PrepRequest } from './prep-request.ts';

/** What each kind of item holds once the AI has drafted it. */
export interface PrepContent {
  readonly plan: WeeklyDraft;
  readonly presentation: PresentationDraft;
  /** Markdown, as the AI assistant writes it. */
  readonly worksheet: string;
  readonly quiz: ExtractedTest;
}

export type PrepItemKind = keyof PrepContent;
export type PrepItemStatus = 'pending' | 'done' | 'failed';

export type PrepItem = {
  [K in PrepItemKind]: {
    readonly key: string;
    readonly kind: K;
    /** 1 for Monday; null for the plan and the quiz, which cover the week. */
    readonly day: number | null;
    readonly status: PrepItemStatus;
    /** Whether the teacher keeps it when publishing. */
    readonly include: boolean;
    readonly content: PrepContent[K] | null;
  };
}[PrepItemKind];

export type PrepStatus = 'running' | 'ready' | 'failed' | 'published';

/** What publishing created, so the teacher can open each item in its editor. */
export interface PrepPublished {
  readonly planId: LessonPlanId | null;
  readonly presentationIds: readonly PresentationId[];
  readonly generationIds: readonly GenerationId[];
  readonly assignmentId: AssignmentId | null;
  readonly emailsSent: number;
  readonly emailsFailed: number;
}

/**
 * A week of AI drafts for one class: plan, slides, worksheets, quiz and parent email. Drafts
 * until the teacher approves and publishes them.
 */
export interface PrepBatch {
  readonly id: PrepBatchId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly classId: ClassId;
  readonly request: PrepRequest;
  readonly status: PrepStatus;
  readonly items: readonly PrepItem[];
  readonly parentEmail: ParentEmail | null;
  /** The job running the current item, to tell a stalled batch. */
  readonly jobId: JobId;
  readonly createdAt: Date;
  readonly readyAt: Date | null;
  readonly publishedAt: Date | null;
  readonly published: PrepPublished | null;
}

const item = (kind: PrepItemKind, day: number | null): PrepItem => ({
  key: day === null ? kind : `${kind}-${String(day)}`,
  kind,
  day,
  status: 'pending',
  include: true,
  content: null,
});

/** The plan first, then each day's slides and worksheet, then the quiz. */
function itemsFor(request: PrepRequest): PrepItem[] {
  const items = [item('plan', null)];
  for (let day = 1; day <= request.days; day += 1) {
    if (request.options.presentations) items.push(item('presentation', day));
    if (request.options.worksheets) items.push(item('worksheet', day));
  }
  if (request.options.quiz) items.push(item('quiz', null));
  return items;
}

export function startBatch(input: {
  readonly id: PrepBatchId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly request: PrepRequest;
  readonly jobId: JobId;
  readonly createdAt: Date;
}): PrepBatch {
  return {
    ...input,
    classId: input.request.classId,
    status: 'running',
    items: itemsFor(input.request),
    parentEmail: null,
    readyAt: null,
    publishedAt: null,
    published: null,
  };
}

export const nextPending = (batch: PrepBatch): PrepItem | null =>
  batch.status === 'running' ? (batch.items.find((i) => i.status === 'pending') ?? null) : null;

const replaceItem = (batch: PrepBatch, key: string, change: Partial<PrepItem>): PrepBatch => ({
  ...batch,
  items: batch.items.map((i) => (i.key === key ? ({ ...i, ...change } as PrepItem) : i)),
});

/** A weekly plan has Monday to Friday; the days after the requested number are left blank. */
const withBlankDays = (batch: PrepBatch, plan: WeeklyDraft): WeeklyDraft => ({
  ...plan,
  days: planWeekdays.map((_, index) =>
    index < batch.request.days ? (plan.days[index] ?? {}) : {},
  ),
});

export function recordDone(
  batch: PrepBatch,
  key: string,
  content: PrepContent[PrepItemKind],
): PrepBatch {
  const found = batch.items.find((i) => i.key === key);
  if (found === undefined) return batch;
  const kept = found.kind === 'plan' ? withBlankDays(batch, content as WeeklyDraft) : content;
  return {
    ...batch,
    items: batch.items.map((i) =>
      i.key === key ? ({ ...i, status: 'done', content: kept } as PrepItem) : i,
    ),
  };
}

/** A failed plan fails the batch (everything builds on it); other items are skipped. */
export function recordFailed(batch: PrepBatch, key: string): PrepBatch {
  const failed = replaceItem(batch, key, { status: 'failed', include: false });
  return key === 'plan' ? { ...failed, status: 'failed' } : failed;
}

/** A batch whose plan failed runs again from the plan; the items it already has are kept. */
export function retryBatch(batch: PrepBatch): Result<PrepBatch, ValidationError> {
  if (batch.status !== 'failed') return invalid('status', 'not_allowed');
  return ok({
    ...replaceItem(batch, 'plan', { status: 'pending', include: true }),
    status: 'running',
  });
}

const planOf = (batch: PrepBatch): WeeklyDraft | null => {
  const plan = batch.items.find((i) => i.kind === 'plan');
  return plan?.kind === 'plan' ? plan.content : null;
};

/** A day's topic: the plan's theme for that day, or the teacher's prompt. */
export function dayTopic(batch: PrepBatch, day: number): string {
  const theme = planOf(batch)?.days[day - 1]?.theme?.trim() ?? '';
  return theme === '' ? batch.request.prompt : theme;
}

const stepOf: Readonly<Record<PrepItemKind, 1 | 2 | 3>> = {
  plan: 1,
  presentation: 2,
  worksheet: 2,
  quiz: 3,
};

export interface PrepProgress {
  /** 1 plan, 2 materials, 3 quiz, 4 calendar and parent email. */
  readonly step: 1 | 2 | 3 | 4;
  readonly done: number;
  readonly total: number;
}

export function prepProgress(batch: PrepBatch): PrepProgress {
  const next = batch.items.find((i) => i.status === 'pending');
  return {
    step: next === undefined ? 4 : stepOf[next.kind],
    done: batch.items.filter((i) => i.status !== 'pending').length,
    total: batch.items.length,
  };
}

/** Every item has run: the batch waits for the teacher, with the parent email drafted. */
export function finishBatch(batch: PrepBatch, now: Date): PrepBatch {
  const { request } = batch;
  const days = Array.from({ length: request.days }, (_, index) => dayTopic(batch, index + 1));
  const hasQuiz = batch.items.some((i) => i.kind === 'quiz' && i.status === 'done');
  return {
    ...batch,
    status: 'ready',
    readyAt: now,
    parentEmail: request.options.parentEmail
      ? parentEmailDraft({ template: request.emailTemplate, dayThemes: days, hasQuiz })
      : null,
  };
}

const notReady = () => invalid('status', 'not_allowed');

/** The teacher keeps the listed items; the others are left out when publishing. */
export function selectItems(
  batch: PrepBatch,
  keys: readonly string[],
): Result<PrepBatch, ValidationError> {
  if (batch.status !== 'ready') return notReady();
  const kept = new Set(keys);
  return ok({
    ...batch,
    items: batch.items.map((i) => ({ ...i, include: i.status === 'done' && kept.has(i.key) })),
  });
}

export function editEmail(
  batch: PrepBatch,
  email: ParentEmail,
): Result<PrepBatch, ValidationError> {
  if (batch.status !== 'ready' || batch.parentEmail === null) return notReady();
  const checked = checkParentEmail(email);
  return checked.ok ? ok({ ...batch, parentEmail: checked.value }) : checked;
}

/** The items to save: drafted and kept by the teacher. */
export const publishable = (batch: PrepBatch): readonly PrepItem[] =>
  batch.items.filter((i) => i.status === 'done' && i.include && i.content !== null);

export function markPublished(
  batch: PrepBatch,
  published: PrepPublished,
  now: Date,
): Result<PrepBatch, ValidationError> {
  if (batch.status !== 'ready') return notReady();
  return ok({ ...batch, status: 'published', publishedAt: now, published });
}
