import type { Language, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/**
 * What the AI may know about a student: numbers and assignment titles only. Never a name,
 * accommodations or the teacher's notes.
 */
export interface InsightRequest {
  readonly language: Language;
  readonly stats: {
    readonly average: number | null;
    readonly attendanceRate: number | null;
    readonly absences: number;
    readonly tardies: number;
    readonly excused: number;
    readonly sessions: number;
    readonly missing: number;
  };
  /** Newest first. */
  readonly recentGrades: readonly {
    readonly title: string;
    readonly date: string | null;
    readonly status: string;
    readonly percentage: number | null;
  }[];
  /** Newest first: absences, tardies and excused days. */
  readonly recentAttendance: readonly { readonly date: string; readonly status: string }[];
}

/** Drafts 3–5 short bullets on a student's trends and next steps for the teacher to check. */
export interface InsightWriter {
  write(request: InsightRequest): Promise<Result<readonly string[], DraftError>>;
}
