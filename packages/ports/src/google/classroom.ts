import type { LocalDate, Result } from '@thp/domain';

export interface ClassroomError {
  readonly code: 'unauthorized' | 'not_found' | 'unavailable';
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

export interface CourseworkRequest {
  readonly title: string;
  readonly description: string;
  readonly link: string;
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
