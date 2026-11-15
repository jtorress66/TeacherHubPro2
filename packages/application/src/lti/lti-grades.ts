import {
  canSendGrades,
  err,
  maxPoints,
  newLineItem,
  ok,
  planGradeSend,
  type Assignment,
  type AssignmentId,
  type ClassId,
  type Job,
  type JobFailure,
  type JobId,
  type LtiCourse,
  type LtiPlacedItem,
  type LtiPlatformId,
  type Result,
  type StudentId,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GameRepository,
  GradeRepository,
  JobQueue,
  LtiCourseRepository,
  LtiGradesClient,
  LtiPlacementRepository,
  LtiPlatformRepository,
  LtiStudentLinkRepository,
  StudentRepository,
  UserRepository,
} from '@thp/ports';
import { managedAssignment } from '../assignments/assignment-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { recordApproval, type ApprovalLogDeps } from '../security/approvals.ts';

// Sending grades to a course's gradebook (Assignment and Grade Services): the teacher asks, a job
// sends each linked student's confirmed grade, and the teacher sees what went and what did not.

export const ltiGradeSendJobKind = 'lti_grade_send';

/** A course the teacher can send an assignment's grades to. */
export interface LtiGradeTarget {
  readonly platformId: LtiPlatformId;
  readonly contextId: string;
  readonly title: string;
}

/** What a send did, as the finished job keeps it. */
export interface LtiGradeSendResult {
  readonly course: string;
  readonly sent: number;
  /** Students without a grade the teacher confirmed. */
  readonly notConfirmed: number;
  /** Students the course system does not know (not linked by a class list import). */
  readonly notLinked: number;
  /** Scores the course system would not take. */
  readonly failed: number;
}

interface TargetDeps {
  readonly classes: ClassRepository;
  readonly assignments: AssignmentRepository;
  readonly games: GameRepository;
  readonly ltiPlacements: LtiPlacementRepository;
  readonly ltiCourses: LtiCourseRepository;
}

interface SendRef {
  readonly actor: User;
  readonly classId: ClassId;
  readonly assignmentId: AssignmentId;
}

/** The assignment, and the games whose grades it holds: each may be placed in a course. */
async function itemsOf(deps: TargetDeps, assignment: Assignment): Promise<LtiPlacedItem[]> {
  const games = await deps.games.listByClass(assignment.schoolId, assignment.classId);
  return [
    { kind: 'assignment', id: assignment.id },
    ...games
      .filter((game) => game.grading.assignmentId === assignment.id)
      .map((game): LtiPlacedItem => ({ kind: 'game', id: game.id })),
  ];
}

/**
 * The teacher's own courses (opened from the course system) where the assignment, or a game graded
 * into it, is placed; each with whether its gradebook takes grades.
 */
async function placedCourses(
  deps: TargetDeps,
  actor: User,
  assignment: Assignment,
): Promise<readonly LtiCourse[]> {
  const seen = new Set<string>();
  const courses: LtiCourse[] = [];
  for (const item of await itemsOf(deps, assignment)) {
    for (const placed of await deps.ltiPlacements.listForItem(assignment.schoolId, item)) {
      const key = JSON.stringify([placed.platformId, placed.contextId]);
      if (seen.has(key)) continue;
      seen.add(key);
      const course = await deps.ltiCourses.find(
        assignment.schoolId,
        actor.id,
        placed.platformId,
        placed.contextId,
      );
      if (course !== null) courses.push(course);
    }
  }
  return courses;
}

/** The courses an assignment's grades can be sent to: one "Send grades" button each. */
export class ListLtiGradeTargets {
  constructor(private readonly deps: TargetDeps) {}

  async execute(input: SendRef): Promise<Result<readonly LtiGradeTarget[], UseCaseError>> {
    const found = await managedAssignment(this.deps, input);
    if (!found.ok) return found;
    const courses = await placedCourses(this.deps, input.actor, found.value.assignment);
    return ok(
      courses
        .filter(canSendGrades)
        .map(({ platformId, contextId, title }) => ({ platformId, contextId, title })),
    );
  }
}

interface SendPayload {
  readonly assignmentId: AssignmentId;
  readonly classId: ClassId;
  readonly platformId: LtiPlatformId;
  readonly contextId: string;
}

type SendInput = SendRef & { readonly platformId: LtiPlatformId; readonly contextId: string };

/** The course to send to, when the actor may send this assignment's grades there. */
async function sendableCourse(
  deps: TargetDeps,
  input: SendInput,
): Promise<Result<{ assignment: Assignment; course: LtiCourse }, UseCaseError>> {
  const found = await managedAssignment(deps, input);
  if (!found.ok) return found;
  const { assignment } = found.value;
  const course = (await placedCourses(deps, input.actor, assignment)).find(
    (row) => row.platformId === input.platformId && row.contextId === input.contextId,
  );
  if (course === undefined) return fail('not_found');
  return canSendGrades(course) ? ok({ assignment, course }) : fail('course_system_refused');
}

/**
 * The teacher asks to send an assignment's confirmed grades to one of their courses: checked
 * here, then sent by a job (the course system may take a while). Only the job's id comes back.
 */
export class StartLtiGradeSend {
  constructor(private readonly deps: TargetDeps & { readonly jobs: JobQueue }) {}

  async execute(input: SendInput): Promise<Result<{ readonly jobId: JobId }, UseCaseError>> {
    const found = await sendableCourse(this.deps, input);
    if (!found.ok) return found;
    const payload: SendPayload = {
      assignmentId: found.value.assignment.id,
      classId: found.value.assignment.classId,
      platformId: input.platformId,
      contextId: input.contextId,
    };
    const job = await this.deps.jobs.enqueue({
      schoolId: input.actor.schoolId,
      ownerId: input.actor.id,
      kind: ltiGradeSendJobKind,
      payload,
    });
    return ok({ jobId: job.id });
  }
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

function readPayload(value: unknown): SendPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const { assignmentId, classId, platformId, contextId } = value as Record<string, unknown>;
  if (!isText(assignmentId) || !isText(classId) || !isText(platformId) || !isText(contextId)) {
    return null;
  }
  return {
    assignmentId: assignmentId as AssignmentId,
    classId: classId as ClassId,
    platformId: platformId as LtiPlatformId,
    contextId,
  };
}

export type LtiGradeSendDeps = TargetDeps &
  ApprovalLogDeps & {
    readonly users: UserRepository;
    readonly students: StudentRepository;
    readonly grades: GradeRepository;
    readonly ltiPlatforms: LtiPlatformRepository;
    readonly ltiStudentLinks: LtiStudentLinkRepository;
    readonly ltiGrades: LtiGradesClient;
  };

interface Failure {
  readonly code: JobFailure;
}

/**
 * Sends the grades, as the teacher who asked (their access is checked again): each linked
 * student's confirmed grade, under the course system's own id for them, in the assignment's
 * column. Only scores leave TeacherHubPro, never names. Once grades went in, the send is logged as
 * the teacher's approval, with how many.
 */
export class LtiGradeSendHandler implements JobHandler {
  readonly kind = ltiGradeSendJobKind;

  constructor(private readonly deps: LtiGradeSendDeps) {}

  async handle(job: Job): Promise<Result<LtiGradeSendResult, Failure>> {
    const payload = readPayload(job.payload);
    const actor = await this.deps.users.findById(job.schoolId, job.ownerId);
    if (payload === null || actor?.suspendedAt !== null) {
      return err({ code: 'failed' });
    }
    const found = await sendableCourse(this.deps, { actor, ...payload });
    const platform = await this.deps.ltiPlatforms.findById(job.schoolId, payload.platformId);
    if (!found.ok || platform === null) return err({ code: 'failed' });
    const { assignment, course } = found.value;
    const { lineItemsUrl } = course;
    if (lineItemsUrl === null) return err({ code: 'failed' });
    const plan = await this.plan(assignment, payload.platformId);
    const sent = await this.deps.ltiGrades.sendScores(platform, {
      lineItemsUrl,
      lineItem: newLineItem({ ...assignment, maxPoints: maxPoints(assignment) }),
      scores: plan.scores,
    });
    if (!sent.ok) {
      return err({
        code: sent.error === 'not_allowed' ? 'course_system_refused' : 'course_system_unavailable',
      });
    }
    if (sent.value.sent > 0) {
      await recordApproval(this.deps, {
        actor,
        action: 'grades_sent_to_course',
        schoolId: assignment.schoolId,
        targetId: assignment.id,
        classId: assignment.classId,
        count: sent.value.sent,
      });
    }
    return ok({
      course: course.title,
      sent: sent.value.sent,
      notConfirmed: plan.notConfirmed,
      notLinked: plan.notLinked,
      failed: sent.value.failed,
    });
  }

  private async plan(assignment: Assignment, platformId: LtiPlatformId) {
    const { schoolId, classId } = assignment;
    const roster = await this.deps.students.listByClass(schoolId, classId);
    const links = await this.deps.ltiStudentLinks.listForClass(schoolId, classId, platformId);
    const grades = await this.deps.grades.listByAssignment(schoolId, assignment.id);
    return planGradeSend({
      studentIds: roster.map((student) => student.id),
      subjects: new Map<StudentId, string>(links.map((link) => [link.studentId, link.subject])),
      grades: new Map(grades.map((grade) => [grade.studentId, grade])),
      maxPoints: maxPoints(assignment),
      now: this.deps.clock.now(),
    });
  }
}
