import { err, ok, type LocalDate, type Result } from '@thp/domain';
import type {
  ClassroomCourse,
  ClassroomCourses,
  ClassroomCoursework,
  ClassroomError,
  ClassroomStudent,
  CourseworkRequest,
} from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const api = 'https://classroom.googleapis.com/v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

function failure(status: number): ClassroomError {
  if (status === 401 || status === 403) return { code: 'unauthorized' };
  if (status === 404) return { code: 'not_found' };
  return { code: 'unavailable' };
}

const dueParts = (date: LocalDate) => {
  const [year, month, day] = date.split('-').map(Number);
  return { dueDate: { year, month, day }, dueTime: { hours: 23, minutes: 59 } };
};

/**
 * Google Classroom through its official REST API with the teacher's access token. Only the
 * courses the teacher teaches, their rosters' names, and coursework the teacher creates.
 */
export class GoogleClassroom implements ClassroomCourses, ClassroomCoursework {
  constructor(private readonly fetchFn: Fetch = fetch) {}

  private async call(
    accessToken: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Result<Record<string, unknown>, ClassroomError>> {
    try {
      const response = await this.fetchFn(`${api}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      });
      if (!response.ok) return err(failure(response.status));
      const body: unknown = await response.json();
      return ok(isRecord(body) ? body : {});
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  async listCourses(
    accessToken: string,
  ): Promise<Result<readonly ClassroomCourse[], ClassroomError>> {
    const body = await this.call(
      accessToken,
      '/courses?teacherId=me&courseStates=ACTIVE&pageSize=100',
    );
    if (!body.ok) return body;
    return ok(
      list(body.value.courses).map((course) => ({
        id: textOf(course.id),
        name: textOf(course.name),
        section: typeof course.section === 'string' ? course.section : null,
      })),
    );
  }

  async listRoster(
    accessToken: string,
    courseId: string,
  ): Promise<Result<readonly ClassroomStudent[], ClassroomError>> {
    const body = await this.call(
      accessToken,
      `/courses/${encodeURIComponent(courseId)}/students?pageSize=100`,
    );
    if (!body.ok) return body;
    return ok(
      list(body.value.students).flatMap((student) => {
        const profile = isRecord(student.profile) ? student.profile : {};
        const name = isRecord(profile.name) ? profile.name : {};
        const firstName = textOf(name.givenName).trim();
        const lastName = textOf(name.familyName).trim();
        return firstName === '' && lastName === '' ? [] : [{ firstName, lastName }];
      }),
    );
  }

  async createCoursework(
    accessToken: string,
    courseId: string,
    coursework: CourseworkRequest,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    const body = await this.call(
      accessToken,
      `/courses/${encodeURIComponent(courseId)}/courseWork`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: coursework.title,
          description: coursework.description,
          materials: [{ link: { url: coursework.link } }],
          workType: 'ASSIGNMENT',
          state: 'PUBLISHED',
          ...(coursework.dueDate === null ? {} : dueParts(coursework.dueDate)),
        }),
      },
    );
    if (!body.ok) return body;
    return ok({ id: textOf(body.value.id), url: textOf(body.value.alternateLink) });
  }
}
