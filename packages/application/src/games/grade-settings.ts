import {
  attachGradeAssignment,
  createAssignment,
  ok,
  setGrading,
  updateAssignment,
  type Assignment,
  type AssignmentId,
  type ClassId,
  type Game,
  type GradeCategoryId,
  type Result,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GameRepository,
  GradeCategoryRepository,
  IdGenerator,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import { findOwnGame, type GameRef } from './game-access.ts';

export interface GameGradingInput extends GameRef {
  readonly countAsGrade: boolean;
  readonly method: string;
  readonly points: number;
  readonly categoryId: GradeCategoryId | null;
}

/** The game's gradebook assignment: created the first time, then kept in step with the game. */
function gradeAssignment(
  game: Game,
  where: { readonly classId: ClassId; readonly categoryId: GradeCategoryId },
  existing: Assignment | null,
  newId: AssignmentId,
): Result<Assignment, UseCaseError> {
  const details = { title: game.title, categoryId: where.categoryId, points: game.grading.points };
  return existing === null
    ? createAssignment({ ...details, id: newId, schoolId: game.schoolId, classId: where.classId })
    : updateAssignment(existing, { ...details, dueDate: existing.dueDate });
}

/**
 * Whether the game counts as a grade, by which attempt and for how many points. Turning it on
 * adds an assignment to the class's gradebook; grades still wait for the teacher to confirm.
 */
export class SaveGameGrading {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly classes: ClassRepository;
      readonly gradeCategories: GradeCategoryRepository;
      readonly assignments: AssignmentRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: GameGradingInput): Promise<Result<Game, UseCaseError>> {
    const found = await findOwnGame(this.deps.games, input);
    if (!found.ok) return found;
    const game = setGrading(found.value, input);
    if (!game.ok) return game;
    if (!game.value.grading.countAsGrade || game.value.classId === null) {
      await this.deps.games.save(game.value);
      return game;
    }
    const cls = await findEditableClass(this.deps.classes, input.actor, game.value.classId);
    if (!cls.ok) return cls;
    const category =
      input.categoryId === null
        ? null
        : await this.deps.gradeCategories.findById(game.value.schoolId, input.categoryId);
    if (category?.classId !== cls.value.id) return fail('not_found');
    const existing =
      game.value.grading.assignmentId === null
        ? null
        : await this.deps.assignments.findById(
            game.value.schoolId,
            game.value.grading.assignmentId,
          );
    const assignment = gradeAssignment(
      game.value,
      { classId: cls.value.id, categoryId: category.id },
      existing,
      this.deps.ids.next() as AssignmentId,
    );
    if (!assignment.ok) return assignment;
    await this.deps.assignments.save(assignment.value);
    const saved = attachGradeAssignment(game.value, assignment.value.id);
    await this.deps.games.save(saved);
    return ok(saved);
  }
}
