import type { SchoolId, StudentId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

export const minInsightBullets = 3;
export const maxInsightBullets = 5;
export const maxInsightBulletLength = 300;

/**
 * An AI-drafted summary of a student's trends for one teacher: advice to check, never shown to
 * families. The latest one is kept per teacher and student.
 */
export interface StudentInsight {
  readonly schoolId: SchoolId;
  readonly studentId: StudentId;
  readonly teacherId: UserId;
  readonly bullets: readonly string[];
  readonly generatedAt: Date;
}

export function createStudentInsight(
  input: StudentInsight,
): Result<StudentInsight, ValidationError> {
  const count = input.bullets.length;
  if (count < minInsightBullets || count > maxInsightBullets)
    return invalid('bullets', 'out_of_range');
  const bullets: string[] = [];
  for (const bullet of input.bullets) {
    const text = requiredText('bullets', bullet, maxInsightBulletLength);
    if (!text.ok) return text;
    bullets.push(text.value);
  }
  return ok({ ...input, bullets });
}
