import { z } from 'zod';
import {
  attendanceStatuses,
  err,
  maxMinutesLate,
  maxNoteLength,
  ok,
  type AttendanceMark,
  type Result,
  type StudentId,
} from '@thp/domain';
import type { Locale } from '@thp/i18n';
import { locale } from './forms.ts';

export type AttendanceFieldCode = 'invalid_format' | 'out_of_range' | 'too_long';

/** Errors keyed by the field's name, such as `minutesLate.<studentId>`. */
export type AttendanceFieldErrors = Readonly<Record<string, AttendanceFieldCode>>;

export interface AttendanceForm {
  readonly locale: Locale;
  readonly classId: string;
  readonly date: string;
  readonly intent: 'save' | 'submit';
  readonly marks: readonly AttendanceMark[];
}

const status = z.enum(attendanceStatuses);
const minutesLate = z.coerce.number().int().min(1).max(maxMinutesLate);
const note = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().max(maxNoteLength));

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

/**
 * The attendance sheet: one `status.<studentId>` per student, with optional
 * `minutesLate.<studentId>` (kept only for a tardy) and `note.<studentId>`.
 */
export function parseAttendanceForm(data: FormData): Result<AttendanceForm, AttendanceFieldErrors> {
  const errors: Record<string, AttendanceFieldCode> = {};
  const marks: AttendanceMark[] = [];
  for (const key of data.keys()) {
    if (!key.startsWith('status.')) continue;
    const studentId = key.slice('status.'.length);
    const parsedStatus = status.safeParse(field(data, key));
    if (!parsedStatus.success) {
      errors[key] = 'invalid_format';
      continue;
    }
    const late = field(data, `minutesLate.${studentId}`).trim();
    const parsedLate =
      parsedStatus.data === 'tardy' && late !== '' ? minutesLate.safeParse(late) : null;
    if (parsedLate && !parsedLate.success) errors[`minutesLate.${studentId}`] = 'out_of_range';
    const parsedNote = note.safeParse(field(data, `note.${studentId}`));
    if (!parsedNote.success) errors[`note.${studentId}`] = 'too_long';
    marks.push({
      studentId: studentId as StudentId,
      status: parsedStatus.data,
      minutesLate: parsedLate?.data ?? null,
      note: parsedNote.success && parsedNote.data !== '' ? parsedNote.data : null,
    });
  }
  if (Object.keys(errors).length > 0) return err(errors);
  return ok({
    locale: locale.parse(data.get('locale') ?? undefined),
    classId: field(data, 'classId'),
    date: field(data, 'date'),
    intent: field(data, 'intent') === 'submit' ? 'submit' : 'save',
    marks,
  });
}
