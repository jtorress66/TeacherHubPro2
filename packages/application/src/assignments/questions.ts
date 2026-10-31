import {
  createQuestion,
  invalid,
  replaceQuestions,
  setInstructions,
  type Assignment,
  type Question,
  type QuestionInput,
  type Result,
} from '@thp/domain';
import type { SubmissionRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import {
  editableAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';

type Deps = AssignmentAccessDeps & { readonly submissions: SubmissionRepository };

/** The question builder's save: the whole list at once, each question checked. */
export class SaveQuestions {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: AssignmentRef & { readonly questions: readonly QuestionInput[] },
  ): Promise<Result<Assignment, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    const submitted = await this.deps.submissions.listByAssignment(
      assignment.schoolId,
      assignment.id,
    );
    // Students' answers and scores refer to the questions; changing them would break both.
    if (submitted.length > 0) return fail('has_submissions');
    const questions: Question[] = [];
    for (const [index, question] of input.questions.entries()) {
      const created = createQuestion(question);
      if (!created.ok) {
        return invalid(`questions.${String(index)}.${created.error.field}`, created.error.code);
      }
      questions.push(created.value);
    }
    const updated = replaceQuestions(assignment, questions);
    if (!updated.ok) return updated;
    await this.deps.assignments.save(updated.value);
    return updated;
  }
}

/** The general instructions shown to students above the questions. */
export class SaveInstructions {
  constructor(private readonly deps: AssignmentAccessDeps) {}

  async execute(
    input: AssignmentRef & { readonly instructions: string | null },
  ): Promise<Result<Assignment, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const updated = setInstructions(found.value.assignment, input.instructions);
    if (!updated.ok) return updated;
    await this.deps.assignments.save(updated.value);
    return updated;
  }
}
