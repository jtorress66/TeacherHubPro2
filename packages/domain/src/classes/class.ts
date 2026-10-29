import type { ClassId, SchoolId, SemesterId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import { createSchedule, type Schedule, type ScheduleInput } from './schedule.ts';

export interface Class {
  readonly id: ClassId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly name: string;
  readonly subject: string | null;
  readonly grade: string | null;
  readonly section: string | null;
  readonly schoolYear: string | null;
  readonly semesterId: SemesterId | null;
  readonly schedule: Schedule | null;
  /** When the class was archived (hidden but kept, with its roster); null while in use. */
  readonly archivedAt: Date | null;
}

export interface ClassInput {
  readonly id: ClassId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly name: string;
  readonly subject?: string | null;
  readonly grade?: string | null;
  readonly section?: string | null;
  readonly schoolYear?: string | null;
  readonly semesterId?: SemesterId | null;
  readonly schedule?: ScheduleInput | null;
}

type OptionalField = 'subject' | 'grade' | 'section' | 'schoolYear';
const optionalFields: readonly OptionalField[] = ['subject', 'grade', 'section', 'schoolYear'];

export function createClass(input: ClassInput): Result<Class, ValidationError> {
  const name = requiredText('name', input.name);
  if (!name.ok) return name;

  const optional: Record<OptionalField, string | null> = {
    subject: null,
    grade: null,
    section: null,
    schoolYear: null,
  };
  for (const field of optionalFields) {
    const value = optionalText(field, input[field]);
    if (!value.ok) return value;
    optional[field] = value.value;
  }

  let schedule: Schedule | null = null;
  if (input.schedule != null) {
    const parsed = createSchedule(input.schedule);
    if (!parsed.ok) return parsed;
    schedule = parsed.value;
  }

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    name: name.value,
    ...optional,
    semesterId: input.semesterId ?? null,
    schedule,
    archivedAt: null,
  });
}

export type ClassChanges = Omit<ClassInput, 'id' | 'schoolId' | 'teacherId'>;

/** Replaces the editable fields with the same rules as creating a class. */
export function updateClass(cls: Class, changes: ClassChanges): Result<Class, ValidationError> {
  const updated = createClass({
    ...changes,
    id: cls.id,
    schoolId: cls.schoolId,
    teacherId: cls.teacherId,
  });
  return updated.ok ? ok({ ...updated.value, archivedAt: cls.archivedAt }) : updated;
}

/** Hides the class from everyday lists while keeping it and its roster. */
export const archiveClass = (cls: Class, now: Date): Class => ({ ...cls, archivedAt: now });

export const restoreClass = (cls: Class): Class => ({ ...cls, archivedAt: null });
