import {
  archivePath,
  assignPath,
  createLearningPath,
  createPathRequest,
  editPath,
  focusOf,
  ok,
  pathProgress,
  startingLevel,
  studentLearningProgress,
  type ClassId,
  type Job,
  type JobFailure,
  type LearningPath,
  type LearningPathId,
  type PathEdit,
  type PathProgress,
  type PathRequest,
  type Result,
  type StudentId,
  type SubjectProgress,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  IdGenerator,
  JobQueue,
  LearningPathRepository,
  LessonAttemptRepository,
  PathWriter,
  StudentRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { byName } from '../students/roster-order.ts';

export const learningPathJobKind = 'learning.generate';

/** What a draft job carries; only `request` reaches the AI. */
interface LearningPathPayload {
  readonly request: PathRequest;
  readonly studentId: StudentId;
  readonly classId: ClassId;
}

interface PathDeps {
  readonly learningPaths: LearningPathRepository;
  readonly lessonAttempts: LessonAttemptRepository;
  readonly classes: ClassRepository;
}

/** A path in the actor's school, of a class they manage; anything else is not found or forbidden. */
async function findOwnPath(
  deps: PathDeps,
  actor: User,
  pathId: LearningPathId,
): Promise<Result<LearningPath, UseCaseError>> {
  const path = await deps.learningPaths.findById(actor.schoolId, pathId);
  if (path === null) return fail('not_found');
  const cls = await findManagedClass(deps.classes, actor, path.classId);
  return cls.ok ? ok(path) : cls;
}

/** Paths the student was given in a subject (drafts are not theirs yet), and their attempts. */
async function historyOf(deps: PathDeps, actor: User, studentId: StudentId, subject: string) {
  const paths = (await deps.learningPaths.listByStudent(actor.schoolId, studentId)).filter(
    (path) => path.subject === subject && path.status !== 'draft',
  );
  const attempts = await deps.lessonAttempts.listByPaths(
    actor.schoolId,
    paths.map((path) => path.id),
  );
  return { paths, attempts };
}

export interface LearningPathInput {
  readonly actor: User;
  readonly classId: ClassId;
  /** One student, or the whole class when left out. */
  readonly studentId?: StudentId;
  readonly subject: string;
  readonly grade: string;
  readonly language?: string;
  readonly lessonCount?: number;
  readonly topic?: string | null;
  readonly esl?: boolean;
}

/**
 * Queues an AI draft of a learning path for one student or each student of a class, each at the
 * student's own level and focus. Needs AI access. Nothing reaches students until the teacher
 * assigns it.
 */
export class RequestLearningPath {
  constructor(
    private readonly deps: PathDeps & {
      readonly students: StudentRepository;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: LearningPathInput): Promise<Result<readonly Job[], UseCaseError>> {
    const { actor } = input;
    const cls = await findManagedClass(this.deps.classes, actor, input.classId);
    if (!cls.ok) return cls;
    const base = {
      subject: input.subject,
      grade: input.grade,
      language: input.language ?? actor.language,
      ...(input.lessonCount === undefined ? {} : { lessonCount: input.lessonCount }),
      topic: input.topic ?? null,
      esl: input.esl === true,
    };
    const valid = createPathRequest({ ...base, level: 3 });
    if (!valid.ok) return valid;
    const access = await checkAiAccess(this.deps, actor);
    if (!access.ok) return access;
    const roster = await this.deps.students.listByClass(actor.schoolId, cls.value.id);
    const students =
      input.studentId === undefined
        ? [...roster].sort(byName)
        : roster.filter((student) => student.id === input.studentId);
    if (students.length === 0) return fail('not_found');
    const jobs: Job[] = [];
    for (const student of students) {
      const { paths, attempts } = await historyOf(this.deps, actor, student.id, input.subject);
      const latest = paths.at(-1);
      const focus = focusOf(latest === undefined ? [] : [latest], attempts);
      const request = createPathRequest({
        ...base,
        level: startingLevel(paths, attempts),
        review: focus.review,
        mastered: focus.mastered,
      });
      if (!request.ok) return request;
      const payload: LearningPathPayload = {
        request: request.value,
        studentId: student.id,
        classId: cls.value.id,
      };
      jobs.push(
        await this.deps.jobs.enqueue({
          schoolId: actor.schoolId,
          ownerId: actor.id,
          kind: learningPathJobKind,
          payload,
        }),
      );
    }
    return ok(jobs);
  }
}

/** Writes the path with the AI and saves it as a draft for the teacher who asked. */
export class LearningPathHandler implements JobHandler {
  readonly kind = learningPathJobKind;

  constructor(
    private readonly deps: {
      readonly pathWriter: PathWriter;
      readonly learningPaths: LearningPathRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async handle(
    job: Job,
  ): Promise<Result<{ readonly pathId: LearningPathId }, { readonly code: JobFailure }>> {
    const { request, studentId, classId } = job.payload as LearningPathPayload;
    const draft = await this.deps.pathWriter.write(request);
    if (!draft.ok) return draft;
    const path = createLearningPath({
      id: this.deps.ids.next() as LearningPathId,
      schoolId: job.schoolId,
      teacherId: job.ownerId,
      studentId,
      classId,
      subject: request.subject,
      grade: request.grade,
      language: request.language,
      level: request.level,
      ...draft.value,
      createdAt: this.deps.clock.now(),
    });
    if (!path.ok) return { ok: false, error: { code: 'invalid_output' } };
    await this.deps.learningPaths.save(path.value);
    return ok({ pathId: path.value.id });
  }
}

interface PathRef {
  readonly actor: User;
  readonly pathId: LearningPathId;
}

export class GetLearningPath {
  constructor(private readonly deps: PathDeps) {}

  execute(input: PathRef): Promise<Result<LearningPath, UseCaseError>> {
    return findOwnPath(this.deps, input.actor, input.pathId);
  }
}

/** The teacher's edits to a draft (title, description, lessons and checks). */
export class UpdateLearningPath {
  constructor(private readonly deps: PathDeps) {}

  async execute(
    input: PathRef & { readonly edit: PathEdit },
  ): Promise<Result<LearningPath, UseCaseError>> {
    const path = await findOwnPath(this.deps, input.actor, input.pathId);
    if (!path.ok) return path;
    const edited = editPath(path.value, input.edit);
    if (!edited.ok) return edited;
    await this.deps.learningPaths.save(edited.value);
    return edited;
  }
}

/** Puts the path on the student's link; the path they had in the subject is archived. */
export class AssignLearningPath {
  constructor(private readonly deps: PathDeps & { readonly clock: Clock }) {}

  async execute(input: PathRef): Promise<Result<LearningPath, UseCaseError>> {
    const path = await findOwnPath(this.deps, input.actor, input.pathId);
    if (!path.ok) return path;
    const assigned = assignPath(path.value, this.deps.clock.now());
    if (!assigned.ok) return assigned;
    const current = (
      await this.deps.learningPaths.listByStudent(input.actor.schoolId, path.value.studentId)
    ).filter((p) => p.subject === path.value.subject && p.status === 'assigned');
    for (const previous of current) {
      const archived = archivePath(previous);
      if (archived.ok) await this.deps.learningPaths.save(archived.value);
    }
    await this.deps.learningPaths.save(assigned.value);
    return assigned;
  }
}

/** Takes the path off the student's link; its progress stays. */
export class ArchiveLearningPath {
  constructor(private readonly deps: PathDeps) {}

  async execute(input: PathRef): Promise<Result<LearningPath, UseCaseError>> {
    const path = await findOwnPath(this.deps, input.actor, input.pathId);
    if (!path.ok) return path;
    const archived = archivePath(path.value);
    if (!archived.ok) return archived;
    await this.deps.learningPaths.save(archived.value);
    return archived;
  }
}

export class DeleteLearningPath {
  constructor(private readonly deps: PathDeps) {}

  async execute(input: PathRef): Promise<Result<true, UseCaseError>> {
    const path = await findOwnPath(this.deps, input.actor, input.pathId);
    if (!path.ok) return path;
    await this.deps.lessonAttempts.deleteByPath(input.actor.schoolId, path.value.id);
    await this.deps.learningPaths.delete(input.actor.schoolId, path.value.id);
    return ok(true);
  }
}

export interface StudentLearningRow {
  readonly studentId: StudentId;
  readonly firstName: string;
  readonly lastName: string;
  readonly done: number;
  readonly total: number;
  readonly average: number | null;
  readonly lastActivity: Date | null;
  /** The level of each subject's latest path. */
  readonly levels: readonly { readonly subject: string; readonly level: number }[];
}

export interface ClassLearning {
  readonly students: readonly StudentLearningRow[];
  /** Drafts waiting for the teacher's review, oldest first. */
  readonly drafts: readonly LearningPath[];
}

const sumOf = (subjects: readonly SubjectProgress[], key: 'done' | 'total'): number =>
  subjects.reduce((sum, subject) => sum + subject[key], 0);

/** Overall average over subjects, weighted by lessons done. */
function overallAverage(subjects: readonly SubjectProgress[]): number | null {
  const scored = subjects.filter((s) => s.average !== null && s.done > 0);
  const done = sumOf(scored, 'done');
  if (done === 0) return null;
  return Math.round(scored.reduce((sum, s) => sum + (s.average ?? 0) * s.done, 0) / done);
}

const latestDate = (dates: readonly (Date | null)[]): Date | null =>
  dates.reduce<Date | null>(
    (last, at) => (at !== null && (last === null || at > last) ? at : last),
    null,
  );

/** Every student of the class with their progress, and the drafts to review. */
export class GetClassLearning {
  constructor(private readonly deps: PathDeps & { readonly students: StudentRepository }) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
  }): Promise<Result<ClassLearning, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const { schoolId } = input.actor;
    const roster = [...(await this.deps.students.listByClass(schoolId, cls.value.id))].sort(byName);
    const paths = await this.deps.learningPaths.listByClass(schoolId, cls.value.id);
    const attempts = await this.deps.lessonAttempts.listByPaths(
      schoolId,
      paths.map((path) => path.id),
    );
    const students = roster.map((student) => {
      const subjects = studentLearningProgress(
        paths.filter((path) => path.studentId === student.id),
        attempts,
      );
      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        done: sumOf(subjects, 'done'),
        total: sumOf(subjects, 'total'),
        average: overallAverage(subjects),
        lastActivity: latestDate(subjects.map((s) => s.lastActivity)),
        levels: subjects.map(({ subject, level }) => ({ subject, level })),
      };
    });
    return ok({ students, drafts: paths.filter((path) => path.status === 'draft') });
  }
}

export interface StudentLearning {
  readonly studentId: StudentId;
  readonly firstName: string;
  readonly lastName: string;
  readonly classId: ClassId;
  readonly subjects: readonly SubjectProgress[];
  /** Newest first, drafts included, each with its progress. */
  readonly paths: readonly { readonly path: LearningPath; readonly progress: PathProgress }[];
}

/** One student's learning: progress by subject and every path with its lessons' scores. */
export class GetStudentLearning {
  constructor(private readonly deps: PathDeps & { readonly students: StudentRepository }) {}

  async execute(input: {
    readonly actor: User;
    readonly studentId: StudentId;
  }): Promise<Result<StudentLearning, UseCaseError>> {
    const { schoolId } = input.actor;
    const student = await this.deps.students.findById(schoolId, input.studentId);
    if (student === null) return fail('not_found');
    const cls = await findManagedClass(this.deps.classes, input.actor, student.classId);
    if (!cls.ok) return cls;
    const paths = await this.deps.learningPaths.listByStudent(schoolId, student.id);
    const attempts = await this.deps.lessonAttempts.listByPaths(
      schoolId,
      paths.map((path) => path.id),
    );
    return ok({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      classId: student.classId,
      subjects: studentLearningProgress(paths, attempts),
      paths: [...paths].reverse().map((path) => ({ path, progress: pathProgress(path, attempts) })),
    });
  }
}
