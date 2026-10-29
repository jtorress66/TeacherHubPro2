import type { ClassId, GradeCategoryId, SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

export interface GradeCategory {
  readonly id: GradeCategoryId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly name: string;
  /** Share of the overall grade, 0–100. Rescaled over categories that have grades. */
  readonly weightPercent: number;
}

export interface GradeCategoryInput {
  readonly id: GradeCategoryId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly name: string;
  readonly weightPercent?: number;
}

export function createGradeCategory(
  input: GradeCategoryInput,
): Result<GradeCategory, ValidationError> {
  const name = requiredText('name', input.name, 100);
  if (!name.ok) return name;
  const weightPercent = input.weightPercent ?? 100;
  if (!(weightPercent >= 0 && weightPercent <= 100))
    return invalid('weightPercent', 'out_of_range');

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    classId: input.classId,
    name: name.value,
    weightPercent,
  });
}
