import {
  byCurriculumOrder,
  canManageSchool,
  curriculumFileKindOf,
  curriculumGuideRead,
  curriculumGuideUnreadable,
  guideUsage,
  maxAttachmentBytes,
  ok,
  pastedCurriculumGuide,
  uploadedCurriculumGuide,
  withReadingJob,
  type AuditAction,
  type AuditEventId,
  type CurriculumFileKind,
  type CurriculumGuide,
  type CurriculumGuideId,
  type Job,
  type JobFailure,
  type Result,
  type User,
  type ValidationError,
} from '@thp/domain';
import type {
  AuditLog,
  Clock,
  CurriculumGuideRepository,
  DocumentTextExtractor,
  FileStore,
  IdGenerator,
  JobQueue,
  SubscriptionRepository,
} from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';

export const curriculumReadJobKind = 'curriculum.read';

/** Where a guide's text comes from: typed or pasted in, or a PDF or Word file. */
export type CurriculumSource =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'file'; readonly fileName: string; readonly bytes: Uint8Array };

interface CurriculumReadPayload {
  readonly guideId: CurriculumGuideId;
  readonly fileKey: string;
  readonly fileKind: CurriculumFileKind;
}

const contentTypes: Readonly<Record<CurriculumFileKind, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

interface AccessDeps {
  readonly subscriptions: SubscriptionRepository;
}

/** The school's admins and its account owner manage its curriculum; everyone else reads it. */
async function mayManage(deps: AccessDeps, actor: User): Promise<boolean> {
  const subscription = await findSchoolSubscription(deps.subscriptions, actor.schoolId);
  return canManageSchool(actor, subscription);
}

interface LogDeps {
  readonly auditLog: AuditLog;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

const record = (deps: LogDeps, actor: User, action: AuditAction, targetId: string) =>
  deps.auditLog.record({
    id: deps.ids.next() as AuditEventId,
    schoolId: actor.schoolId,
    actorId: actor.id,
    action,
    targetId,
    at: deps.clock.now(),
    review: null,
    count: null,
    classId: null,
  });

function checkFile(
  source: Extract<CurriculumSource, { kind: 'file' }>,
): Result<CurriculumFileKind, ValidationError> {
  const kind = curriculumFileKindOf(source.fileName);
  if (kind === null) return { ok: false, error: { field: 'file', code: 'not_allowed' } };
  if (source.bytes.length === 0) return { ok: false, error: { field: 'file', code: 'required' } };
  if (source.bytes.length > maxAttachmentBytes) {
    return { ok: false, error: { field: 'file', code: 'too_large' } };
  }
  return ok(kind);
}

export interface UploadCurriculumGuideDeps extends AccessDeps, LogDeps {
  readonly curriculumGuides: CurriculumGuideRepository;
  readonly files: FileStore;
  readonly jobs: JobQueue;
}

/**
 * Adds a guide for a subject and grade, replacing the school's current one for them. Pasted text
 * is ready at once; a file is kept only until a job has read its text.
 */
export class UploadCurriculumGuide {
  constructor(private readonly deps: UploadCurriculumGuideDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly subject: string;
    readonly grade: string;
    readonly title: string;
    readonly source: CurriculumSource;
  }): Promise<Result<CurriculumGuide, UseCaseError>> {
    const { actor, source } = input;
    if (!(await mayManage(this.deps, actor))) return fail('forbidden');
    const fileKind = source.kind === 'file' ? checkFile(source) : null;
    if (fileKind?.ok === false) return fileKind;

    const fields = {
      id: await this.idFor(input),
      schoolId: actor.schoolId,
      subject: input.subject,
      grade: input.grade,
      title: input.title,
      updatedBy: actor.id,
      now: this.deps.clock.now(),
    };
    const made =
      source.kind === 'text'
        ? pastedCurriculumGuide({ ...fields, text: source.text })
        : uploadedCurriculumGuide({ ...fields, sourceName: source.fileName.trim() });
    if (!made.ok) return made;

    let guide = made.value;
    if (source.kind === 'file' && fileKind?.ok === true) {
      const started = await this.startReading(actor, guide, source.bytes, fileKind.value);
      if (!started.ok) return started;
      guide = started.value;
    }
    await this.deps.curriculumGuides.save(guide);
    await record(this.deps, actor, 'curriculum_uploaded', guide.id);
    return ok(guide);
  }

  /** The current guide's ID for the same subject and grade, so the new one takes its place. */
  private async idFor(input: {
    readonly actor: User;
    readonly subject: string;
    readonly grade: string;
  }): Promise<CurriculumGuideId> {
    const current = (await this.deps.curriculumGuides.listBySchool(input.actor.schoolId)).find(
      (g) => g.subject === input.subject && g.grade === input.grade,
    );
    return current?.id ?? (this.deps.ids.next() as CurriculumGuideId);
  }

  private async startReading(
    actor: User,
    guide: CurriculumGuide,
    bytes: Uint8Array,
    fileKind: CurriculumFileKind,
  ): Promise<Result<CurriculumGuide, UseCaseError>> {
    const fileKey = `curriculum/${actor.schoolId}/${this.deps.ids.next()}.${fileKind}`;
    const stored = await this.deps.files.put(fileKey, {
      bytes,
      contentType: contentTypes[fileKind],
    });
    if (!stored.ok) return fail('storage_unavailable');
    const payload: CurriculumReadPayload = { guideId: guide.id, fileKey, fileKind };
    const job = await this.deps.jobs.enqueue({
      schoolId: actor.schoolId,
      ownerId: actor.id,
      kind: curriculumReadJobKind,
      payload,
    });
    return ok(withReadingJob(guide, job.id));
  }
}

/**
 * Reads an uploaded guide's text and deletes the file. Only the job the guide is waiting for may
 * fill it in, so a replaced or removed guide stays as it is.
 */
export class CurriculumReadHandler implements JobHandler {
  readonly kind = curriculumReadJobKind;

  constructor(
    private readonly deps: {
      readonly files: FileStore;
      readonly curriculumGuides: CurriculumGuideRepository;
      readonly readers: Readonly<Record<CurriculumFileKind, DocumentTextExtractor>>;
      readonly clock: Clock;
    },
  ) {}

  async handle(
    job: Job,
  ): Promise<Result<{ readonly guideId: CurriculumGuideId }, { readonly code: JobFailure }>> {
    const payload = job.payload as CurriculumReadPayload;
    try {
      const guide = await this.deps.curriculumGuides.find(job.schoolId, payload.guideId);
      if (guide?.jobId !== job.id) return ok({ guideId: payload.guideId });
      await this.deps.curriculumGuides.save(await this.read(guide, payload));
      return ok({ guideId: guide.id });
    } finally {
      await this.deps.files.delete(payload.fileKey);
    }
  }

  private async read(
    guide: CurriculumGuide,
    payload: CurriculumReadPayload,
  ): Promise<CurriculumGuide> {
    const now = this.deps.clock.now();
    const file = await this.deps.files.get(payload.fileKey);
    if (!file.ok) return curriculumGuideUnreadable(guide, now);
    const text = await this.deps.readers[payload.fileKind].extract(file.value.bytes);
    return text.ok
      ? curriculumGuideRead(guide, text.value.text, now)
      : curriculumGuideUnreadable(guide, now);
  }
}

/** A guide as the list shows it: how much of it the AI reads. */
export type CurriculumGuideEntry = CurriculumGuide & {
  readonly usage: { readonly used: number; readonly total: number };
};

/** The school's guides, for everyone in it, and whether this person may change them. */
export class ListCurriculumGuides {
  constructor(
    private readonly deps: AccessDeps & { readonly curriculumGuides: CurriculumGuideRepository },
  ) {}

  async execute(input: { readonly actor: User }): Promise<{
    readonly guides: readonly CurriculumGuideEntry[];
    readonly canManage: boolean;
  }> {
    const guides = [...(await this.deps.curriculumGuides.listBySchool(input.actor.schoolId))]
      .sort(byCurriculumOrder)
      .map((guide) => ({ ...guide, usage: guideUsage(guide) }));
    return { guides, canManage: await mayManage(this.deps, input.actor) };
  }
}

/** Removes one of the school's guides; the AI stops following it at once. */
export class RemoveCurriculumGuide {
  constructor(
    private readonly deps: AccessDeps &
      LogDeps & { readonly curriculumGuides: CurriculumGuideRepository },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly guideId: CurriculumGuideId;
  }): Promise<Result<true, UseCaseError>> {
    const { actor } = input;
    if (!(await mayManage(this.deps, actor))) return fail('forbidden');
    const guide = await this.deps.curriculumGuides.find(actor.schoolId, input.guideId);
    if (guide === null) return fail('not_found');
    await this.deps.curriculumGuides.remove(actor.schoolId, guide.id);
    await record(this.deps, actor, 'curriculum_removed', guide.id);
    return ok(true);
  }
}
