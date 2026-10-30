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

export type GradeCategoryDetails = Pick<GradeCategoryInput, 'name' | 'weightPercent'>;

export function updateGradeCategory(
  category: GradeCategory,
  details: GradeCategoryDetails,
): Result<GradeCategory, ValidationError> {
  return createGradeCategory({ ...category, ...details });
}

export const standardCategoryKeys = ['homework', 'quiz', 'test', 'project'] as const;

export type StandardCategoryKey = (typeof standardCategoryKeys)[number];

/** The starting categories of the original app; the names come from the teacher's language. */
export const standardCategories: readonly {
  readonly key: StandardCategoryKey;
  readonly weightPercent: number;
}[] = [
  { key: 'homework', weightPercent: 25 },
  { key: 'quiz', weightPercent: 25 },
  { key: 'test', weightPercent: 30 },
  { key: 'project', weightPercent: 20 },
];
