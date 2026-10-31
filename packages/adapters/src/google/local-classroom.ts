import { err, ok, type Result } from '@thp/domain';
import type {
  ClassroomAuthorization,
  ClassroomCourse,
  ClassroomCourses,
  ClassroomCoursework,
  ClassroomError,
  ClassroomStudent,
} from '@thp/ports';

// Stand-ins for Google Classroom in local runs and E2E tests: no Google project, no network.

const localCode = 'local-classroom-code';
const localRefresh = 'local-classroom-refresh';
const localAccess = 'local-classroom-access';

export const localClassroomFixture = {
  accessToken: localAccess,
  course: { id: 'local-course', name: 'Local Classroom course', section: null },
  roster: [
    { firstName: 'Lucía', lastName: 'Rivera' },
    { firstName: 'Mateo', lastName: 'Ortiz' },
  ],
} as const satisfies {
  accessToken: string;
  course: ClassroomCourse;
  roster: readonly ClassroomStudent[];
};

/** Grants access at once: the address goes straight back to the app with a known code. */
export class LocalClassroomAuthorization implements ClassroomAuthorization {
  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set('code', localCode);
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
  }

  exchangeCode(code: string): Promise<Result<{ readonly refreshToken: string }, ClassroomError>> {
    return Promise.resolve(
      code === localCode ? ok({ refreshToken: localRefresh }) : err({ code: 'unauthorized' }),
    );
  }

  accessToken(refreshToken: string): Promise<Result<string, ClassroomError>> {
    return Promise.resolve(
      refreshToken === localRefresh ? ok(localAccess) : err({ code: 'unauthorized' }),
    );
  }
}

/** One course with two students; shared coursework is kept in memory. */
export class LocalClassroom implements ClassroomCourses, ClassroomCoursework {
  private shared = 0;

  private check(accessToken: string, courseId?: string): Result<true, ClassroomError> {
    if (accessToken !== localAccess) return err({ code: 'unauthorized' });
    if (courseId !== undefined && courseId !== localClassroomFixture.course.id)
      return err({ code: 'not_found' });
    return ok(true);
  }

  listCourses(accessToken: string): Promise<Result<readonly ClassroomCourse[], ClassroomError>> {
    const access = this.check(accessToken);
    return Promise.resolve(access.ok ? ok([localClassroomFixture.course]) : access);
  }

  listRoster(
    accessToken: string,
    courseId: string,
  ): Promise<Result<readonly ClassroomStudent[], ClassroomError>> {
    const access = this.check(accessToken, courseId);
    return Promise.resolve(access.ok ? ok(localClassroomFixture.roster) : access);
  }

  createCoursework(
    accessToken: string,
    courseId: string,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    const access = this.check(accessToken, courseId);
    if (!access.ok) return Promise.resolve(access);
    this.shared += 1;
    const id = `local-cw-${String(this.shared)}`;
    return Promise.resolve(ok({ id, url: `https://classroom.local/c/${courseId}/a/${id}` }));
  }
}
