import {
  type AssignmentId,
  type GameId,
  type LtiPlacedItem,
  type SchoolId,
  type Student,
  type StudentId,
} from '@thp/domain';
import type { Clock, StudentRepository, TicketSigner } from '@thp/ports';

// A student pass: a short-lived signed ticket that lets one roster student open one assignment or
// game, given to a student who opened it from their course system. It is separate from the
// student's own link (whose token is stored only as a hash, and never revealed or reused here).

const passPurpose = 'lti-student';

/** A pass works this long after the launch; the student opens the item again from the course. */
export const studentPassLifetimeMs = 2 * 60 * 60 * 1000;

/** The one student and item a pass opens. */
export interface StudentPass {
  readonly student: Student;
  readonly item: LtiPlacedItem;
}

/** A pass for this student and this item only. */
export function issueStudentPass(
  deps: { readonly ticketSigner: TicketSigner },
  student: Student,
  item: LtiPlacedItem,
  now: Date,
): string {
  return deps.ticketSigner.sign(
    {
      purpose: passPurpose,
      schoolId: student.schoolId,
      studentId: student.id,
      kind: item.kind,
      itemId: item.id,
    },
    new Date(now.getTime() + studentPassLifetimeMs),
  );
}

export interface StudentPassDeps {
  readonly ticketSigner: TicketSigner;
  readonly students: StudentRepository;
  readonly clock: Clock;
}

function itemOf(kind: string | undefined, id: string | undefined): LtiPlacedItem | null {
  if (id === undefined) return null;
  if (kind === 'assignment') return { kind, id: id as AssignmentId };
  return kind === 'game' ? { kind, id: id as GameId } : null;
}

/** The student and item of a genuine, unexpired pass whose student is still on the roster. */
export async function readStudentPass(
  deps: StudentPassDeps,
  pass: string,
): Promise<StudentPass | null> {
  const payload = deps.ticketSigner.verify(pass, deps.clock.now());
  if (payload?.purpose !== passPurpose) return null;
  const item = itemOf(payload.kind, payload.itemId);
  const { schoolId, studentId } = payload;
  if (item === null || schoolId === undefined || studentId === undefined) return null;
  const student = await deps.students.findById(schoolId as SchoolId, studentId as StudentId);
  return student === null ? null : { student, item };
}
