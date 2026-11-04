import {
  ok,
  type Assignment,
  type AssignmentDetails,
  type ClassId,
  type Job,
  type Result,
  type User,
} from '@thp/domain';
import type {
  Clock,
  FileStore,
  GradeCategoryRepository,
  IdGenerator,
  JobQueue,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import type { UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import { CreateAssignment } from '../gradebook/assignments.ts';
import type { AssignmentAccessDeps } from './assignment-access.ts';
import { pdfSizeError, RequestPdfImport } from './pdf-import.ts';

/**
 * A new assignment read from a test PDF, in one step: the assignment is made and the PDF import
 * queued for it. Everything is checked first, and a refused import leaves no empty assignment.
 */
export class StartPdfTest {
  constructor(
    private readonly deps: AssignmentAccessDeps & {
      readonly gradeCategories: GradeCategoryRepository;
      readonly files: FileStore;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
    readonly details: AssignmentDetails;
    readonly pdf: Uint8Array;
  }): Promise<Result<{ readonly assignment: Assignment; readonly job: Job }, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const access = await checkAiAccess(this.deps, input.actor.schoolId);
    if (!access.ok) return access;
    const size = pdfSizeError(input.pdf);
    if (!size.ok) return size;
    const assignment = await new CreateAssignment(this.deps).execute(input);
    if (!assignment.ok) return assignment;
    const job = await new RequestPdfImport(this.deps).execute({
      actor: input.actor,
      classId: input.classId,
      assignmentId: assignment.value.id,
      pdf: input.pdf,
    });
    if (!job.ok) {
      await this.deps.assignments.delete(assignment.value.schoolId, assignment.value.id);
      return job;
    }
    return ok({ assignment: assignment.value, job: job.value });
  }
}
