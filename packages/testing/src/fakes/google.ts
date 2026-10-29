import { err, ok, type Result } from '@thp/domain';
import type {
  ClassroomCourse,
  ClassroomCourses,
  ClassroomCoursework,
  ClassroomError,
  ClassroomStudent,
  CourseworkRequest,
  GoogleIdentity,
  GoogleIdentityError,
  GoogleProfile,
} from '@thp/ports';

/** Knows which OAuth codes are valid and the profile behind each. */
export class FakeGoogleIdentity implements GoogleIdentity {
  constructor(private readonly profiles: Readonly<Record<string, GoogleProfile>>) {}

  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL('https://accounts.test/o/oauth2/auth');
    url.search = new URLSearchParams({ state, redirect_uri: redirectUri }).toString();
    return url.toString();
  }

  exchangeCode(code: string): Promise<Result<GoogleProfile, GoogleIdentityError>> {
    const profile = this.profiles[code];
    return Promise.resolve(profile === undefined ? err({ code: 'invalid_code' }) : ok(profile));
  }
}

export interface FakeClassroomSetup {
  readonly accessToken: string;
  readonly course: ClassroomCourse;
  readonly roster: readonly ClassroomStudent[];
}

/** One teacher, one course: enough for share and import flows. */
export class FakeClassroom implements ClassroomCourses, ClassroomCoursework {
  readonly coursework: CourseworkRequest[] = [];

  constructor(private readonly setup: FakeClassroomSetup) {}

  listCourses(accessToken: string): Promise<Result<readonly ClassroomCourse[], ClassroomError>> {
    return Promise.resolve(
      this.authorized(accessToken) ? ok([this.setup.course]) : err({ code: 'unauthorized' }),
    );
  }

  listRoster(
    accessToken: string,
    courseId: string,
  ): Promise<Result<readonly ClassroomStudent[], ClassroomError>> {
    const access = this.access(accessToken, courseId);
    return Promise.resolve(access.ok ? ok(this.setup.roster) : access);
  }

  createCoursework(
    accessToken: string,
    courseId: string,
    coursework: CourseworkRequest,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    const access = this.access(accessToken, courseId);
    if (!access.ok) return Promise.resolve(access);
    this.coursework.push(coursework);
    const id = `cw-${String(this.coursework.length)}`;
    return Promise.resolve(ok({ id, url: `https://classroom.test/c/${courseId}/a/${id}` }));
  }

  private authorized(accessToken: string): boolean {
    return accessToken === this.setup.accessToken;
  }

  private access(accessToken: string, courseId: string): Result<true, ClassroomError> {
    if (!this.authorized(accessToken)) return err({ code: 'unauthorized' });
    return courseId === this.setup.course.id ? ok(true) : err({ code: 'not_found' });
  }
}
