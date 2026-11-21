import { parseOptionalEmail, type Email } from '../shared/email.ts';
import type { ClassId, SchoolId, StudentId } from '../shared/ids.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

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
  /** The language the family reads, when it is not the teacher's; null means the teacher's. */
  readonly familyLanguage: Language | null;
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
  readonly familyLanguage?: string | null;
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
  const familyLanguage = input.familyLanguage?.trim() ?? '';
  if (familyLanguage !== '' && !isLanguage(familyLanguage)) {
    return invalid('familyLanguage', 'invalid_format');
  }

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    classId: input.classId,
    firstName: firstName.value,
    lastName: lastName.value,
    studentNumber: studentNumber.value,
    parentEmail: parentEmail.value,
    accommodations: accommodations.value,
    familyLanguage: familyLanguage === '' ? null : familyLanguage,
  });
}

export type StudentChanges = Omit<StudentInput, 'id' | 'schoolId' | 'classId'>;

export function updateStudent(
  student: Student,
  changes: StudentChanges,
): Result<Student, ValidationError> {
  return createStudent({
    ...changes,
    id: student.id,
    schoolId: student.schoolId,
    classId: student.classId,
  });
}
