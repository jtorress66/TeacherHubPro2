import type { LocalDate, Result } from '@thp/domain';

export interface ClassroomError {
  /**
   * `api_disabled`: a Google API is turned off in the Cloud project; `insufficient_scope`: the
   * teacher's grant predates a scope the call needs.
   */
  readonly code:
    'unauthorized' | 'not_found' | 'unavailable' | 'api_disabled' | 'insufficient_scope';
  /** Google's reason token (e.g. `SERVICE_DISABLED`), for logs only. */
  readonly reason?: string;
}

export interface ClassroomCourse {
  readonly id: string;
  readonly name: string;
  readonly section: string | null;
}

export interface ClassroomStudent {
  readonly firstName: string;
  readonly lastName: string;
}

/** Reads a teacher's Google Classroom courses and rosters. */
export interface ClassroomCourses {
  listCourses(accessToken: string): Promise<Result<readonly ClassroomCourse[], ClassroomError>>;
  listRoster(
    accessToken: string,
    courseId: string,
  ): Promise<Result<readonly ClassroomStudent[], ClassroomError>>;
}

/** What students open: a link, or a Drive file (PDF or Doc) each student gets a copy of. */
export type CourseworkMaterial =
  | { readonly kind: 'link'; readonly url: string }
  | { readonly kind: 'driveFile'; readonly driveFileId: string };

export interface CourseworkRequest {
  readonly title: string;
  readonly description: string;
  readonly material: CourseworkMaterial;
  readonly dueDate: LocalDate | null;
}

/** Shares an assignment to a Google Classroom course. */
export interface ClassroomCoursework {
  createCoursework(
    accessToken: string,
    courseId: string,
    coursework: CourseworkRequest,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>>;
}
