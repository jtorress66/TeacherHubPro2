import {
  attemptPercent,
  learnerLesson,
  ok,
  pathProgress,
  scoreCheck,
  type Correction,
  type LearnerLesson,
  type LearningPath,
  type LearningPathId,
  type LessonAttemptId,
  type Result,
} from '@thp/domain';
import type { IdGenerator, LearningPathRepository, LessonAttemptRepository } from '@thp/ports';
import { openLink, type Holder, type LinkDeps } from '../assignments/student-portal.ts';
import { fail, type UseCaseError } from '../errors.ts';

interface StudentLearningDeps extends LinkDeps {
  readonly learningPaths: LearningPathRepository;
  readonly lessonAttempts: LessonAttemptRepository;
}

/** An assigned path of the link's student; drafts, archived paths and others' are not found. */
async function linkPath(
  deps: StudentLearningDeps,
  token: string,
  pathId: LearningPathId,
): Promise<Result<{ holder: Holder; path: LearningPath }, UseCaseError>> {
  const holder = await openLink(deps, token);
  if (!holder.ok) return holder;
  const path = await deps.learningPaths.findById(holder.value.link.schoolId, pathId);
  if (path?.studentId !== holder.value.student.id || path.status !== 'assigned') {
    return fail('not_found');
  }
  return ok({ holder: holder.value, path });
}

export interface StudentPathSummary {
  readonly id: LearningPathId;
  readonly title: string;
  readonly description: string;
  readonly subject: string;
  readonly language: string;
  readonly done: number;
  readonly total: number;
  readonly average: number | null;
  readonly lessons: readonly {
    readonly title: string;
    readonly minutes: number;
    readonly done: boolean;
    readonly best: number | null;
  }[];
}

/** The paths on the student's link, with their progress. No answers. */
export class ListStudentPaths {
  constructor(private readonly deps: StudentLearningDeps) {}

  async execute(input: {
    readonly token: string;
  }): Promise<Result<readonly StudentPathSummary[], UseCaseError>> {
    const holder = await openLink(this.deps, input.token);
    if (!holder.ok) return holder;
    const { schoolId } = holder.value.link;
    const paths = (
      await this.deps.learningPaths.listByStudent(schoolId, holder.value.student.id)
    ).filter((path) => path.status === 'assigned');
    const attempts = await this.deps.lessonAttempts.listByPaths(
      schoolId,
      paths.map((path) => path.id),
    );
    return ok(
      paths.map((path) => {
        const progress = pathProgress(path, attempts);
        return {
          id: path.id,
          title: path.title,
          description: path.description,
          subject: path.subject,
          language: path.language,
          done: progress.done,
          total: progress.total,
          average: progress.average,
          lessons: path.lessons.map((lesson, i) => ({
            title: lesson.title,
            minutes: lesson.minutes,
            done: progress.lessons[i]?.done ?? false,
            best: progress.lessons[i]?.best ?? null,
          })),
        };
      }),
    );
  }
}

export interface LearnerLessonView {
  readonly pathId: LearningPathId;
  readonly pathTitle: string;
  readonly language: string;
  readonly index: number;
  readonly count: number;
  readonly lesson: LearnerLesson;
  /** The student's best score on this lesson so far, as a percentage. */
  readonly best: number | null;
}

export class OpenLearnerLesson {
  constructor(private readonly deps: StudentLearningDeps) {}

  async execute(input: {
    readonly token: string;
    readonly pathId: LearningPathId;
    readonly lesson: number;
  }): Promise<Result<LearnerLessonView, UseCaseError>> {
    const found = await linkPath(this.deps, input.token, input.pathId);
    if (!found.ok) return found;
    const { path } = found.value;
    const lesson = path.lessons[input.lesson];
    if (lesson === undefined) return fail('not_found');
    const attempts = await this.deps.lessonAttempts.listByPaths(path.schoolId, [path.id]);
    return ok({
      pathId: path.id,
      pathTitle: path.title,
      language: path.language,
      index: input.lesson,
      count: path.lessons.length,
      lesson: learnerLesson(lesson),
      best: pathProgress(path, attempts).lessons[input.lesson]?.best ?? null,
    });
  }
}

export interface CheckResult {
  readonly score: number;
  readonly total: number;
  readonly percent: number;
  /** Shown only now, after submitting: the right answer to each check missed. */
  readonly corrections: readonly Correction[];
}

/** Scores the student's answers on the server and keeps the attempt; retries are welcome. */
export class SubmitLessonCheck {
  constructor(private readonly deps: StudentLearningDeps & { readonly ids: IdGenerator }) {}

  async execute(input: {
    readonly token: string;
    readonly pathId: LearningPathId;
    readonly lesson: number;
    readonly answers: readonly unknown[];
  }): Promise<Result<CheckResult, UseCaseError>> {
    const found = await linkPath(this.deps, input.token, input.pathId);
    if (!found.ok) return found;
    const { path, holder } = found.value;
    const lesson = path.lessons[input.lesson];
    if (lesson === undefined) return fail('not_found');
    const scored = scoreCheck(lesson, input.answers);
    await this.deps.lessonAttempts.save({
      id: this.deps.ids.next() as LessonAttemptId,
      schoolId: path.schoolId,
      pathId: path.id,
      studentId: holder.student.id,
      lesson: input.lesson,
      answers: scored.answers,
      score: scored.score,
      total: scored.total,
      at: this.deps.clock.now(),
    });
    return ok({
      score: scored.score,
      total: scored.total,
      percent: attemptPercent(scored),
      corrections: scored.corrections,
    });
  }
}
