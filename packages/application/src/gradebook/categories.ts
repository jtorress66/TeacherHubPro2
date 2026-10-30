import {
  createGradeCategory,
  ok,
  standardCategories,
  updateGradeCategory,
  type Class,
  type GradeCategory,
  type GradeCategoryDetails,
  type GradeCategoryId,
  type Result,
  type StandardCategoryKey,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GradeCategoryRepository,
  IdGenerator,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass, type ClassInput } from './gradebook-access.ts';

export interface CategoryDeps {
  readonly classes: ClassRepository;
  readonly gradeCategories: GradeCategoryRepository;
}

interface CategoryInput extends ClassInput {
  readonly categoryId: GradeCategoryId;
}

/** The category, which must belong to the class (itself editable by the actor). */
async function findEditableCategory(
  deps: CategoryDeps,
  input: CategoryInput,
): Promise<Result<{ cls: Class; category: GradeCategory }, UseCaseError>> {
  const cls = await findEditableClass(deps.classes, input.actor, input.classId);
  if (!cls.ok) return cls;
  const category = await deps.gradeCategories.findById(cls.value.schoolId, input.categoryId);
  if (category?.classId !== cls.value.id) return fail('not_found');
  return ok({ cls: cls.value, category });
}

/** A class's grade categories, in the order they were added. */
export class ListGradeCategories {
  constructor(private readonly deps: CategoryDeps) {}

  async execute(input: ClassInput): Promise<Result<readonly GradeCategory[], UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    return ok(await this.deps.gradeCategories.listByClass(cls.value.schoolId, cls.value.id));
  }
}

export class AddGradeCategory {
  constructor(private readonly deps: CategoryDeps & { readonly ids: IdGenerator }) {}

  async execute(
    input: ClassInput & { details: GradeCategoryDetails },
  ): Promise<Result<GradeCategory, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const category = createGradeCategory({
      ...input.details,
      id: this.deps.ids.next() as GradeCategoryId,
      schoolId: cls.value.schoolId,
      classId: cls.value.id,
    });
    if (!category.ok) return category;
    await this.deps.gradeCategories.save(category.value);
    return category;
  }
}

/** Homework, quiz, test and project with the original weights, for a class with no categories. */
export class AddStandardCategories {
  constructor(private readonly deps: CategoryDeps & { readonly ids: IdGenerator }) {}

  async execute(
    input: ClassInput & { names: Readonly<Record<StandardCategoryKey, string>> },
  ): Promise<Result<readonly GradeCategory[], UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const { schoolId, id: classId } = cls.value;
    if ((await this.deps.gradeCategories.listByClass(schoolId, classId)).length > 0) {
      return fail('categories_exist');
    }
    const created: GradeCategory[] = [];
    for (const { key, weightPercent } of standardCategories) {
      const category = createGradeCategory({
        id: this.deps.ids.next() as GradeCategoryId,
        schoolId,
        classId,
        name: input.names[key],
        weightPercent,
      });
      if (!category.ok) return category;
      created.push(category.value);
    }
    for (const category of created) await this.deps.gradeCategories.save(category);
    return ok(created);
  }
}

export class UpdateGradeCategory {
  constructor(private readonly deps: CategoryDeps) {}

  async execute(
    input: CategoryInput & { details: GradeCategoryDetails },
  ): Promise<Result<GradeCategory, UseCaseError>> {
    const found = await findEditableCategory(this.deps, input);
    if (!found.ok) return found;
    const updated = updateGradeCategory(found.value.category, input.details);
    if (!updated.ok) return updated;
    await this.deps.gradeCategories.save(updated.value);
    return updated;
  }
}

/** Deletes a category that has no assignments (as in the original app). */
export class DeleteGradeCategory {
  constructor(
    private readonly deps: CategoryDeps & { readonly assignments: AssignmentRepository },
  ) {}

  async execute(input: CategoryInput): Promise<Result<true, UseCaseError>> {
    const found = await findEditableCategory(this.deps, input);
    if (!found.ok) return found;
    const { schoolId, id } = found.value.category;
    if ((await this.deps.assignments.countByCategory(schoolId, id)) > 0) {
      return fail('category_in_use');
    }
    await this.deps.gradeCategories.delete(schoolId, id);
    return ok(true);
  }
}
