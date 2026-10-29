import type { SchoolId, SemesterId } from '../shared/ids.ts';
import { compareDates, parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

export interface Semester {
  readonly id: SemesterId;
  readonly schoolId: SchoolId;
  readonly name: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly schoolYear: string | null;
  readonly isActive: boolean;
}

export interface SemesterInput {
  readonly id: SemesterId;
  readonly schoolId: SchoolId;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly schoolYear?: string | null;
  readonly isActive?: boolean;
}

export function createSemester(input: SemesterInput): Result<Semester, ValidationError> {
  const name = requiredText('name', input.name);
  if (!name.ok) return name;
  const startDate = parseLocalDate('startDate', input.startDate);
  if (!startDate.ok) return startDate;
  const endDate = parseLocalDate('endDate', input.endDate);
  if (!endDate.ok) return endDate;
  if (compareDates(endDate.value, startDate.value) < 0) return invalid('endDate', 'invalid_order');
  const schoolYear = optionalText('schoolYear', input.schoolYear);
  if (!schoolYear.ok) return schoolYear;

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    name: name.value,
    startDate: startDate.value,
    endDate: endDate.value,
    schoolYear: schoolYear.value,
    isActive: input.isActive ?? false,
  });
}

/** Makes `id` the only active semester in a school's list. */
export function activateSemester(
  semesters: readonly Semester[],
  id: SemesterId,
): Result<readonly Semester[], { readonly code: 'not_found' }> {
  if (!semesters.some((semester) => semester.id === id)) return err({ code: 'not_found' });
  return ok(semesters.map((semester) => ({ ...semester, isActive: semester.id === id })));
}
