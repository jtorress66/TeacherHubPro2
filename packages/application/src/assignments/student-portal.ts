import {
  isUsable,
  ok,
  playableModes,
  type GameId,
  type GameModeId,
  type GameModeRegistry,
  questionForStudent,
  submitAnswers,
  type Assignment,
  type AssignmentId,
  type AttachmentId,
  type LocalDate,
  type LtiPlacedItem,
  type Result,
  type Student,
  type StudentQuestion,
  type SubmissionId,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttachmentRepository,
  ClassRepository,
  Clock,
  FileStore,
  GameRepository,
  IdGenerator,
  SchoolRepository,
  StudentLinkRepository,
  StudentRepository,
  SubmissionRepository,
  TicketSigner,
  TokenHasher,
} from '@thp/ports';
import { fail, submissionFailure, type UseCaseError } from '../errors.ts';
import { readStudentPass } from './student-pass.ts';

// The pages a student opens from their personal link. Students have no accounts: the link's
// token is the key, and everything it opens is limited to that student and their class. A student
// who opened one item from their course system holds a pass instead, which opens only that item.

export interface LinkDeps {
  readonly studentLinks: StudentLinkRepository;
  readonly tokenHasher: TokenHasher;
  readonly students: StudentRepository;
  readonly ticketSigner: TicketSigner;
  readonly clock: Clock;
}

interface PortalDeps extends LinkDeps {
  readonly classes: ClassRepository;
  readonly schools: SchoolRepository;
  readonly assignments: AssignmentRepository;
  readonly attachments: AttachmentRepository;
  readonly submissions: SubmissionRepository;
}

/** The student behind a link or a pass, and the one item a pass opens (null for a link). */
export interface Holder {
  readonly student: Student;
  readonly only: LtiPlacedItem | null;
}

/** How a student gets in: their personal link's token, or a pass for one item. */
export type StudentKey = { readonly token: string } | { readonly pass: string };

/** The student behind a working link; anything else is simply not found. */
export async function openLink(
  deps: LinkDeps,
  token: string,
): Promise<Result<Holder, UseCaseError>> {
  const link = await deps.studentLinks.findByTokenHash(await deps.tokenHasher.hash(token));
  if (link === null || !isUsable(link, deps.clock.now())) return fail('not_found');
  const student = await deps.students.findById(link.schoolId, link.studentId);
  return student?.classId === link.classId ? ok({ student, only: null }) : fail('not_found');
}

/** The student behind a working link or pass; anything else is simply not found. */
export async function openStudent(
  deps: LinkDeps,
  key: StudentKey,
): Promise<Result<Holder, UseCaseError>> {
  if ('token' in key) return openLink(deps, key.token);
  const pass = await readStudentPass(deps, key.pass);
  return pass === null ? fail('not_found') : ok({ student: pass.student, only: pass.item });
}

/** Whether the holder may open this item: any of their class's with a link, one with a pass. */
export const mayOpen = (holder: Holder, item: LtiPlacedItem): boolean =>
  holder.only === null || (holder.only.kind === item.kind && holder.only.id === item.id);

/** Ready for students: it has questions or files to open. */
export async function isReady(
  deps: Pick<PortalDeps, 'attachments'>,
  assignment: Assignment,
): Promise<boolean> {
  if (assignment.questions.length > 0) return true;
  return (await deps.attachments.listByAssignment(assignment.schoolId, assignment.id)).length > 0;
}

async function classAssignment(
  deps: PortalDeps,
  holder: Holder,
  assignmentId: AssignmentId,
): Promise<Result<Assignment, UseCaseError>> {
  if (!mayOpen(holder, { kind: 'assignment', id: assignmentId })) return fail('not_found');
  const assignment = await deps.assignments.findById(holder.student.schoolId, assignmentId);
  if (assignment?.classId !== holder.student.classId) return fail('not_found');
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
  readonly games: readonly {
    readonly id: GameId;
    readonly title: string;
    readonly modes: readonly GameModeId[];
  }[];
}

/** The student's first name, the assignments ready for them and their class's games. */
export class OpenStudentLink {
  constructor(
    private readonly deps: PortalDeps & {
      readonly games: GameRepository;
      readonly gameModes: GameModeRegistry;
    },
  ) {}

  async execute(input: { readonly token: string }): Promise<Result<StudentPortal, UseCaseError>> {
    const holder = await openLink(this.deps, input.token);
    if (!holder.ok) return holder;
    const { student } = holder.value;
    const link = { schoolId: student.schoolId, classId: student.classId };
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
    const games = (await this.deps.games.listByClass(link.schoolId, link.classId))
      .map((game) => ({
        id: game.id,
        title: game.title,
        modes: playableModes(game, this.deps.gameModes).map((mode) => mode.id),
      }))
      .filter((game) => game.modes.length > 0);
    return ok({
      firstName: student.firstName,
      className: cls.name,
      schoolName: school.name,
      assignments: ready,
      games,
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

  async execute(
    input: StudentKey & { readonly assignmentId: AssignmentId },
  ): Promise<Result<StudentAssignmentView, UseCaseError>> {
    const holder = await openStudent(this.deps, input);
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

  async execute(
    input: StudentKey & {
      readonly assignmentId: AssignmentId;
      readonly answers: Readonly<Record<string, string>>;
    },
  ): Promise<Result<{ readonly submittedAt: Date; readonly late: boolean }, UseCaseError>> {
    const holder = await openStudent(this.deps, input);
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

  async execute(
    input: StudentKey & { readonly attachmentId: AttachmentId },
  ): Promise<Result<{ name: string; contentType: string; bytes: Uint8Array }, UseCaseError>> {
    const holder = await openStudent(this.deps, input);
    if (!holder.ok) return holder;
    const attachment = await this.deps.attachments.findById(
      holder.value.student.schoolId,
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
