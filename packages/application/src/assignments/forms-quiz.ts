import { ok, toFormsQuiz, type FormsExport, type Result, type TrueFalseLabels } from '@thp/domain';
import type { Clock, FormsExportRepository, GoogleForms } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import {
  editableAssignment,
  managedAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';
import { accessToken, type ConnectionDeps } from './classroom.ts';

/**
 * Makes a self-scoring Google Forms quiz from an assignment's questions, in the teacher's Google
 * account. One-way: Forms keeps its own responses and scores, which never reach the gradebook.
 */
export class MakeFormsQuiz {
  constructor(
    private readonly deps: ConnectionDeps &
      AssignmentAccessDeps & {
        readonly googleForms: GoogleForms;
        readonly formsExports: FormsExportRepository;
        readonly clock: Clock;
      },
  ) {}

  async execute(
    input: AssignmentRef & { readonly labels: TrueFalseLabels },
  ): Promise<Result<FormsExport, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    if (assignment.questions.length === 0) return fail('not_shareable');
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const made = await this.deps.googleForms.createQuiz(
      token.value,
      toFormsQuiz(assignment, input.labels),
    );
    if (!made.ok) {
      return fail(
        made.error.code === 'insufficient_scope' ? 'google_reconnect' : 'classroom_failed',
      );
    }
    const formsExport: FormsExport = {
      schoolId: assignment.schoolId,
      assignmentId: assignment.id,
      formId: made.value.id,
      editUrl: made.value.editUrl,
      responderUrl: made.value.responderUrl,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.formsExports.save(formsExport);
    return ok(formsExport);
  }
}

/** The quiz last made from an assignment, if any. */
export class FindFormsQuiz {
  constructor(
    private readonly deps: AssignmentAccessDeps & {
      readonly formsExports: FormsExportRepository;
    },
  ) {}

  async execute(input: AssignmentRef): Promise<Result<FormsExport | null, UseCaseError>> {
    const found = await managedAssignment(this.deps, input);
    if (!found.ok) return found;
    return ok(
      await this.deps.formsExports.find(found.value.assignment.schoolId, found.value.assignment.id),
    );
  }
}
