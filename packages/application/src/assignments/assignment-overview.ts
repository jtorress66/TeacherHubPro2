import { isUsable, ok, type Result } from '@thp/domain';
import type {
  AttachmentRepository,
  Clock,
  StudentLinkRepository,
  StudentRepository,
  SubmissionRepository,
} from '@thp/ports';
import type { UseCaseError } from '../errors.ts';
import {
  managedAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';
import { isReady } from './student-portal.ts';

/** Where an assignment stands, step by step: what students can see, who has a link, who handed in. */
export interface AssignmentOverview {
  /** Students see it once it has questions or files. */
  readonly ready: boolean;
  readonly questionCount: number;
  readonly fileCount: number;
  readonly studentCount: number;
  /** Students with a link that still works. */
  readonly linkedCount: number;
  readonly handedIn: number;
  /** Handed in, waiting for the teacher's grade. */
  readonly toReview: number;
  readonly confirmed: number;
}

/** The assignment's steps at a glance, for the class's teacher. */
export class GetAssignmentOverview {
  constructor(
    private readonly deps: AssignmentAccessDeps & {
      readonly attachments: AttachmentRepository;
      readonly students: StudentRepository;
      readonly studentLinks: StudentLinkRepository;
      readonly submissions: SubmissionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: AssignmentRef): Promise<Result<AssignmentOverview, UseCaseError>> {
    const found = await managedAssignment(this.deps, input);
    if (!found.ok) return found;
    const { cls, assignment } = found.value;
    const now = this.deps.clock.now();
    const [files, roster, links, submissions] = await Promise.all([
      this.deps.attachments.listByAssignment(cls.schoolId, assignment.id),
      this.deps.students.listByClass(cls.schoolId, cls.id),
      this.deps.studentLinks.listByClass(cls.schoolId, cls.id),
      this.deps.submissions.listByAssignment(cls.schoolId, assignment.id),
    ]);
    const linked = new Set(links.filter((l) => isUsable(l, now)).map((l) => l.studentId));
    const confirmed = submissions.filter((s) => s.status === 'confirmed').length;
    return ok({
      ready: await isReady(this.deps, assignment),
      questionCount: assignment.questions.length,
      fileCount: files.length,
      studentCount: roster.length,
      linkedCount: roster.filter((student) => linked.has(student.id)).length,
      handedIn: submissions.length,
      toReview: submissions.length - confirmed,
      confirmed,
    });
  }
}
