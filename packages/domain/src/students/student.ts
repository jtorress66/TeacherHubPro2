import { parseOptionalEmail, type Email } from '../shared/email.ts';
import type { ClassId, SchoolId, StudentId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

/** A rostered student. Students are minors: keep only what features need. */
export interface Student {
  readonly id: StudentId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly firstName: string;
  readonly lastName: string;
  readonly studentNumber: string | null;
  readonly parentEmail: Email | null;
  readonly accommodations: string | null;
}

export interface StudentInput {
  readonly id: StudentId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly firstName: string;
  readonly lastName: string;
  readonly studentNumber?: string | null;
  readonly parentEmail?: string | null;
  readonly accommodations?: string | null;
}

export function createStudent(input: StudentInput): Result<Student, ValidationError> {
  const firstName = requiredText('firstName', input.firstName, 100);
  if (!firstName.ok) return firstName;
  const lastName = requiredText('lastName', input.lastName, 100);
  if (!lastName.ok) return lastName;
  const studentNumber = optionalText('studentNumber', input.studentNumber, 50);
  if (!studentNumber.ok) return studentNumber;
  const parentEmail = parseOptionalEmail('parentEmail', input.parentEmail);
  if (!parentEmail.ok) return parentEmail;
  const accommodations = optionalText('accommodations', input.accommodations, 2000);
  if (!accommodations.ok) return accommodations;

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    classId: input.classId,
    firstName: firstName.value,
    lastName: lastName.value,
    studentNumber: studentNumber.value,
    parentEmail: parentEmail.value,
    accommodations: accommodations.value,
  });
}
