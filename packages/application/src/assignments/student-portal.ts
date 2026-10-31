import {
  isUsable,
  ok,
  questionForStudent,
  submitAnswers,
  type Assignment,
  type AssignmentId,
  type AttachmentId,
  type LocalDate,
  type Result,
  type Student,
  type StudentLink,
  type StudentQuestion,
  type SubmissionId,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttachmentRepository,
  ClassRepository,
  Clock,
  FileStore,
  IdGenerator,
  SchoolRepository,
  StudentLinkRepository,
  StudentRepository,
  SubmissionRepository,
  TokenHasher,
} from '@thp/ports';
import { fail, submissionFailure, type UseCaseError } from '../errors.ts';

// The pages a student opens from their personal link. Students have no accounts: the link's
// token is the key, and everything it opens is limited to that student and their class.

interface LinkDeps {
  readonly studentLinks: StudentLinkRepository;
  readonly tokenHasher: TokenHasher;
  readonly students: StudentRepository;
  readonly clock: Clock;
}

interface PortalDeps extends LinkDeps {
  readonly classes: ClassRepository;
  readonly schools: SchoolRepository;
  readonly assignments: AssignmentRepository;
  readonly attachments: AttachmentRepository;
  readonly submissions: SubmissionRepository;
}

interface Holder {
  readonly link: StudentLink;
  readonly student: Student;
}

/** The student behind a working link; anything else is simply not found. */
async function openLink(deps: LinkDeps, token: string): Promise<Result<Holder, UseCaseError>> {
  const link = await deps.studentLinks.findByTokenHash(await deps.tokenHasher.hash(token));
  if (link === null || !isUsable(link, deps.clock.now())) return fail('not_found');
  const student = await deps.students.findById(link.schoolId, link.studentId);
  return student?.classId === link.classId ? ok({ link, student }) : fail('not_found');
}

/** Ready for students: it has questions or files to open. */
async function isReady(deps: PortalDeps, assignment: Assignment): Promise<boolean> {
  if (assignment.questions.length > 0) return true;
  return (await deps.attachments.listByAssignment(assignment.schoolId, assignment.id)).length > 0;
}

async function classAssignment(
  deps: PortalDeps,
  holder: Holder,
  assignmentId: AssignmentId,
): Promise<Result<Assignment, UseCaseError>> {
  const assignment = await deps.assignments.findById(holder.link.schoolId, assignmentId);
  if (assignment?.classId !== holder.link.classId) return fail('not_found');
  return (await isReady(deps, assignment)) ? ok(assignment) : fail('not_found');
}

export type StudentAssignmentStatus = 'todo' | 'submitted' | 'graded';

export interface StudentPortal {
  readonly firstName: string;
  readonly className: string;
  readonly schoolName: string;
  readonly assignments: readonly {
    readonly id: AssignmentId;
    readonly title: string;
    readonly dueDate: LocalDate | null;
    readonly status: StudentAssignmentStatus;
  }[];
}

/** The student's first name and the assignments ready for them, with what they have done. */
export class OpenStudentLink {
  constructor(private readonly deps: PortalDeps) {}

  async execute(input: { readonly token: string }): Promise<Result<StudentPortal, UseCaseError>> {
    const holder = await openLink(this.deps, input.token);
    if (!holder.ok) return holder;
    const { link, student } = holder.value;
    const cls = await this.deps.classes.findById(link.schoolId, link.classId);
    const school = await this.deps.schools.findById(link.schoolId);
    if (cls === null || school === null) return fail('not_found');
    const all = await this.deps.assignments.listByClass(link.schoolId, link.classId);
    const ready: StudentPortal['assignments'][number][] = [];
    for (const assignment of all) {
      if (!(await isReady(this.deps, assignment))) continue;
      const submission = await this.deps.submissions.findFor(
        link.schoolId,
        student.id,
        assignment.id,
      );
      const status: StudentAssignmentStatus =
        submission === null ? 'todo' : submission.status === 'confirmed' ? 'graded' : 'submitted';
      ready.push({
        id: assignment.id,
        title: assignment.title,
        dueDate: assignment.dueDate,
        status,
      });
    }
    return ok({
      firstName: student.firstName,
      className: cls.name,
      schoolName: school.name,
      assignments: ready,
    });
  }
}

export interface StudentAssignmentView {
  readonly assignment: {
    readonly id: AssignmentId;
    readonly title: string;
    readonly instructions: string | null;
    readonly dueDate: LocalDate | null;
  };
  readonly questions: readonly StudentQuestion[];
  readonly attachments: readonly {
    readonly id: AttachmentId;
    readonly name: string;
    readonly contentType: string;
    readonly size: number;
  }[];
  /** After submitting: when, and the grade once the teacher has confirmed it. */
  readonly submission: {
    readonly submittedAt: Date;
    readonly late: boolean;
    readonly finalScore: number | null;
    readonly maxPoints: number;
  } | null;
}

/** An assignment to answer: its questions without answers, its files, and any submission. */
export class GetStudentAssignment {
  constructor(private readonly deps: PortalDeps) {}

  async execute(input: {
    readonly token: string;
    readonly assignmentId: AssignmentId;
  }): Promise<Result<StudentAssignmentView, UseCaseError>> {
    const holder = await openLink(this.deps, input.token);
    if (!holder.ok) return holder;
    const found = await classAssignment(this.deps, holder.value, input.assignmentId);
    if (!found.ok) return found;
    const assignment = found.value;
    const files = await this.deps.attachments.listByAssignment(assignment.schoolId, assignment.id);
    const submission = await this.deps.submissions.findFor(
      assignment.schoolId,
      holder.value.student.id,
      assignment.id,
    );
    return ok({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        instructions: assignment.instructions,
        dueDate: assignment.dueDate,
      },
      questions: assignment.questions.map(questionForStudent),
      attachments: files.map(({ id, name, contentType, size }) => ({
        id,
        name,
        contentType,
        size,
      })),
      submission:
        submission === null
          ? null
          : {
              submittedAt: submission.submittedAt,
              late: submission.late,
              finalScore: submission.status === 'confirmed' ? submission.finalScore : null,
              maxPoints: submission.maxPoints,
            },
    });
  }
}

/** The student's answers, once: objective questions are scored at once. */
export class SubmitAnswers {
  constructor(private readonly deps: PortalDeps & { readonly ids: IdGenerator }) {}

  async execute(input: {
    readonly token: string;
    readonly assignmentId: AssignmentId;
    readonly answers: Readonly<Record<string, string>>;
  }): Promise<Result<{ readonly submittedAt: Date; readonly late: boolean }, UseCaseError>> {
    const holder = await openLink(this.deps, input.token);
    if (!holder.ok) return holder;
    const found = await classAssignment(this.deps, holder.value, input.assignmentId);
    if (!found.ok) return found;
    const { student } = holder.value;
    const existing = await this.deps.submissions.findFor(
      student.schoolId,
      student.id,
      found.value.id,
    );
    if (existing !== null) return fail('already_submitted');
    const submission = submitAnswers({
      id: this.deps.ids.next() as SubmissionId,
      assignment: found.value,
      studentId: student.id,
      answers: input.answers,
      submittedAt: this.deps.clock.now(),
    });
    if (!submission.ok) return submissionFailure(submission.error);
    await this.deps.submissions.save(submission.value);
    return ok({ submittedAt: submission.value.submittedAt, late: submission.value.late });
  }
}

/** A file from one of the student's class's assignments. */
export class GetStudentAttachment {
  constructor(private readonly deps: PortalDeps & { readonly files: FileStore }) {}

  async execute(input: {
    readonly token: string;
    readonly attachmentId: AttachmentId;
  }): Promise<Result<{ name: string; contentType: string; bytes: Uint8Array }, UseCaseError>> {
    const holder = await openLink(this.deps, input.token);
    if (!holder.ok) return holder;
    const attachment = await this.deps.attachments.findById(
      holder.value.link.schoolId,
      input.attachmentId,
    );
    if (attachment === null) return fail('not_found');
    const assignment = await classAssignment(this.deps, holder.value, attachment.assignmentId);
    if (!assignment.ok) return assignment;
    const file = await this.deps.files.get(attachment.key);
    if (!file.ok) return fail('not_found');
    return ok({
      name: attachment.name,
      contentType: attachment.contentType,
      bytes: file.value.bytes,
    });
  }
}
