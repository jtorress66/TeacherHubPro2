import {
  confirmAiGrade,
  err,
  gradeManually,
  gradingRequest,
  ok,
  pendingOpenQuestions,
  recordAiFailure,
  recordAiScores,
  type Assignment,
  type AssignmentId,
  type ConfirmedSubmission,
  type GradeId,
  type Job,
  type JobFailure,
  type Language,
  type Result,
  type Student,
  type Submission,
  type SubmissionError,
  type SubmissionId,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  GradeRepository,
  IdGenerator,
  JobQueue,
  StudentRepository,
  SubmissionGrader,
  SubmissionRepository,
  SubscriptionRepository,
  AssignmentRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, submissionFailure, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import {
  editableAssignment,
  managedAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';

export const gradingJobKind = 'submission.ai_grade';

interface GradingPayload {
  readonly assignmentId: AssignmentId;
  readonly language: Language;
}

const byName = (a: Student, b: Student) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

/** Every student in the class with their submission (or none yet), by name. */
export class ListSubmissions {
  constructor(
    private readonly deps: AssignmentAccessDeps & {
      readonly students: StudentRepository;
      readonly submissions: SubmissionRepository;
    },
  ) {}

  async execute(input: AssignmentRef): Promise<
    Result<
      {
        readonly assignment: Assignment;
        readonly rows: readonly { student: Student; submission: Submission | null }[];
      },
      UseCaseError
    >
  > {
    const found = await managedAssignment(this.deps, input);
    if (!found.ok) return found;
    const { cls, assignment } = found.value;
    const roster = await this.deps.students.listByClass(cls.schoolId, cls.id);
    const submissions = await this.deps.submissions.listByAssignment(cls.schoolId, assignment.id);
    return ok({
      assignment,
      rows: [...roster].sort(byName).map((student) => ({
        student,
        submission: submissions.find((s) => s.studentId === student.id) ?? null,
      })),
    });
  }
}

/**
 * Queues AI suggestions for the open answers still waiting. Needs AI access. Returns null when
 * nothing waits (objective questions are already scored, at no cost).
 */
export class RequestAiGrading {
  constructor(
    private readonly deps: AssignmentAccessDeps & {
      readonly submissions: SubmissionRepository;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: AssignmentRef): Promise<Result<Job | null, UseCaseError>> {
    const access = await checkAiAccess(this.deps, input.actor.schoolId);
    if (!access.ok) return access;
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    const waiting = (
      await this.deps.submissions.listByAssignment(assignment.schoolId, assignment.id)
    ).filter((s) => s.status === 'submitted' && pendingOpenQuestions(assignment, s).length > 0);
    if (waiting.length === 0) return ok(null);
    const payload: GradingPayload = { assignmentId: assignment.id, language: input.actor.language };
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: input.actor.schoolId,
        ownerId: input.actor.id,
        kind: gradingJobKind,
        payload,
      }),
    );
  }
}

/**
 * Asks the grader about each waiting submission's open answers and stores its suggestions as a
 * draft. A failure is noted on the submission, which the teacher can still grade by hand.
 */
export class GradingHandler implements JobHandler {
  readonly kind = gradingJobKind;

  constructor(
    private readonly deps: {
      readonly assignments: AssignmentRepository;
      readonly submissions: SubmissionRepository;
      readonly classes: ClassRepository;
      readonly grader: SubmissionGrader;
    },
  ) {}

  async handle(
    job: Job,
  ): Promise<Result<{ graded: number; failed: number }, { readonly code: JobFailure }>> {
    const payload = job.payload as GradingPayload;
    const assignment = await this.deps.assignments.findById(job.schoolId, payload.assignmentId);
    if (assignment === null) return err({ code: 'failed' });
    const cls = await this.deps.classes.findById(job.schoolId, assignment.classId);
    const submissions = await this.deps.submissions.listByAssignment(job.schoolId, assignment.id);
    let graded = 0;
    let failed = 0;
    for (const submission of submissions) {
      if (
        submission.status !== 'submitted' ||
        pendingOpenQuestions(assignment, submission).length === 0
      ) {
        continue;
      }
      const request = gradingRequest(assignment, submission, {
        grade: cls?.grade ?? null,
        language: payload.language,
      });
      const scores = await this.deps.grader.grade(request);
      const next: Result<Submission, SubmissionError> = scores.ok
        ? recordAiScores(assignment, submission, scores.value)
        : recordAiFailure(submission, scores.error.code);
      if (next.ok && scores.ok) graded += 1;
      else failed += 1;
      if (next.ok) await this.deps.submissions.save(next.value);
    }
    return graded === 0 && failed > 0 ? err({ code: 'ai_unavailable' }) : ok({ graded, failed });
  }
}

type DecisionDeps = AssignmentAccessDeps & {
  readonly submissions: SubmissionRepository;
  readonly grades: GradeRepository;
  readonly ids: IdGenerator;
};

/** Records the teacher's decision as the student's one grade (replacing any earlier one). */
async function decide(
  deps: DecisionDeps,
  input: AssignmentRef & { readonly submissionId: SubmissionId },
  apply: (submission: Submission, gradeId: GradeId) => Result<ConfirmedSubmission, SubmissionError>,
): Promise<Result<Submission, UseCaseError>> {
  const found = await editableAssignment(deps, input);
  if (!found.ok) return found;
  const submission = await deps.submissions.findById(
    found.value.assignment.schoolId,
    input.submissionId,
  );
  if (submission?.assignmentId !== found.value.assignment.id) return fail('not_found');
  const earlier = await deps.grades.findFor(
    submission.schoolId,
    submission.studentId,
    submission.assignmentId,
  );
  const decided = apply(submission, earlier?.id ?? (deps.ids.next() as GradeId));
  if (!decided.ok) return submissionFailure(decided.error);
  await deps.grades.save(decided.value.grade);
  await deps.submissions.save(decided.value.submission);
  return ok(decided.value.submission);
}

interface Decision extends AssignmentRef {
  readonly submissionId: SubmissionId;
  readonly comment?: string | null;
}

/** The teacher accepts the draft (code scores plus AI suggestions), optionally adjusting it. */
export class ConfirmGrade {
  constructor(private readonly deps: DecisionDeps) {}

  execute(
    input: Decision & { readonly score?: number },
  ): Promise<Result<Submission, UseCaseError>> {
    return decide(this.deps, input, (submission, gradeId) =>
      confirmAiGrade(submission, {
        gradeId,
        teacherId: input.actor.id,
        comment: input.comment ?? null,
        ...(input.score === undefined ? {} : { score: input.score }),
      }),
    );
  }
}

/** The teacher grades directly, with or without a draft. */
export class GradeByHand {
  constructor(private readonly deps: DecisionDeps) {}

  execute(input: Decision & { readonly score: number }): Promise<Result<Submission, UseCaseError>> {
    return decide(this.deps, input, (submission, gradeId) =>
      gradeManually(submission, {
        gradeId,
        teacherId: input.actor.id,
        comment: input.comment ?? null,
        score: input.score,
      }),
    );
  }
}
