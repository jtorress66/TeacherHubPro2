import type { SchoolId, StudentId, StudentNoteId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { requiredText, type ValidationError } from '../shared/validation.ts';

export const maxStudentNoteLength = 2000;

/** A teacher's private note about a student; only its author sees it. */
export interface StudentNote {
  readonly id: StudentNoteId;
  readonly schoolId: SchoolId;
  readonly studentId: StudentId;
  readonly authorId: UserId;
  readonly text: string;
  readonly createdAt: Date;
}

export function createStudentNote(
  input: Omit<StudentNote, 'text'> & { readonly text: string },
): Result<StudentNote, ValidationError> {
  const text = requiredText('text', input.text, maxStudentNoteLength);
  if (!text.ok) return text;
  return ok({ ...input, text: text.value });
}
