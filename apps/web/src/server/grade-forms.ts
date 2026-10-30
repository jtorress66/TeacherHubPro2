import { z } from 'zod';
import {
  err,
  gradeStatuses,
  ok,
  type AssignmentDetails,
  type GradeCategoryDetails,
  type GradeCategoryId,
  type GradeStatus,
  type Result,
  type StudentId,
} from '@thp/domain';
import type { GradeRowInput } from '@thp/application';
import type { Locale } from '@thp/i18n';
import { locale } from './forms.ts';

export type GradeFieldCode = 'invalid_format' | 'too_long';

/** Errors keyed by the field's name, such as `score.<studentId>`. */
export type GradeFieldErrors = Readonly<Record<string, GradeFieldCode>>;

export interface GradeForm {
  readonly locale: Locale;
  readonly classId: string;
  readonly assignmentId: string;
  readonly rows: readonly GradeRowInput[];
}

/** Blank means "decide from the score": graded with one, pending without. */
const status = z.union([z.literal(''), z.enum(gradeStatuses)]);
const score = z.coerce.number().min(0);
const comment = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().max(2000));
const scored: ReadonlySet<GradeStatus> = new Set(['graded', 'late', 'pending']);

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

/** A number, or NaN for blank or unreadable input, which the domain then refuses. */
const number = (data: FormData, name: string): number => {
  const value = field(data, name).trim();
  return value === '' ? Number.NaN : Number(value);
};

/**
 * One assignment's grade column: `status.<studentId>` per student, with `score.<studentId>`
 * (ignored for missing and excused) and `comment.<studentId>`.
 */
export function parseGradeForm(data: FormData): Result<GradeForm, GradeFieldErrors> {
  const errors: Record<string, GradeFieldCode> = {};
  const rows: GradeRowInput[] = [];
  for (const key of data.keys()) {
    if (!key.startsWith('status.')) continue;
    const studentId = key.slice('status.'.length);
    const chosen = status.safeParse(field(data, key));
    if (!chosen.success) {
      errors[key] = 'invalid_format';
      continue;
    }
    const raw = field(data, `score.${studentId}`).trim();
    const keepsScore = chosen.data === '' || scored.has(chosen.data);
    const parsedScore = keepsScore && raw !== '' ? score.safeParse(raw) : null;
    if (parsedScore && !parsedScore.success) errors[`score.${studentId}`] = 'invalid_format';
    const parsedComment = comment.safeParse(field(data, `comment.${studentId}`));
    if (!parsedComment.success) errors[`comment.${studentId}`] = 'too_long';
    const value = parsedScore?.data ?? null;
    rows.push({
      studentId: studentId as StudentId,
      status: chosen.data === '' ? (value === null ? 'pending' : 'graded') : chosen.data,
      score: value,
      comment: parsedComment.success && parsedComment.data !== '' ? parsedComment.data : null,
    });
  }
  if (Object.keys(errors).length > 0) return err(errors);
  return ok({
    locale: locale.parse(data.get('locale') ?? undefined),
    classId: field(data, 'classId'),
    assignmentId: field(data, 'assignmentId'),
    rows,
  });
}

export function parseCategoryForm(data: FormData) {
  return {
    locale: locale.parse(data.get('locale') ?? undefined),
    classId: field(data, 'classId'),
    categoryId: field(data, 'categoryId') as GradeCategoryId,
    details: {
      name: field(data, 'name'),
      weightPercent: number(data, 'weightPercent'),
    } satisfies GradeCategoryDetails,
  };
}

export function parseAssignmentForm(data: FormData) {
  const dueDate = field(data, 'dueDate').trim();
  return {
    locale: locale.parse(data.get('locale') ?? undefined),
    classId: field(data, 'classId'),
    assignmentId: field(data, 'assignmentId'),
    details: {
      title: field(data, 'title'),
      categoryId: field(data, 'categoryId') as GradeCategoryId,
      points: number(data, 'points'),
      dueDate: dueDate === '' ? null : dueDate,
    } satisfies AssignmentDetails,
  };
}
