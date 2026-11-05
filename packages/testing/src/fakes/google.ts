import { err, ok, type FormsQuiz, type Result } from '@thp/domain';
import type {
  ClassroomCourse,
  ClassroomCourses,
  ClassroomAuthorization,
  ClassroomCoursework,
  ClassroomError,
  ClassroomStudent,
  CourseworkRequest,
  CreatedForm,
  FormsError,
  GoogleDriveFiles,
  GoogleForms,
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

/** Accepts one code; its refresh token yields the given access token. */
export class FakeClassroomAuthorization implements ClassroomAuthorization {
  constructor(
    private readonly setup: { readonly code: string; readonly accessToken: string } = {
      code: 'classroom-code',
      accessToken: 'classroom-access',
    },
  ) {}

  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL('https://accounts.test/classroom');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
  }

  exchangeCode(code: string): Promise<Result<{ readonly refreshToken: string }, ClassroomError>> {
    return Promise.resolve(
      code === this.setup.code
        ? ok({ refreshToken: `refresh-for-${code}` })
        : err({ code: 'unauthorized' }),
    );
  }

  accessToken(refreshToken: string): Promise<Result<string, ClassroomError>> {
    return Promise.resolve(
      refreshToken === `refresh-for-${this.setup.code}`
        ? ok(this.setup.accessToken)
        : err({ code: 'unauthorized' }),
    );
  }
}

/** Keeps the quizzes it makes; a teacher connected before Forms access gets `insufficient_scope`. */
export class FakeGoogleForms implements GoogleForms {
  readonly quizzes: FormsQuiz[] = [];

  constructor(
    private readonly setup: { readonly accessToken: string; readonly withoutScope?: string } = {
      accessToken: 'classroom-access',
    },
  ) {}

  createQuiz(accessToken: string, quiz: FormsQuiz): Promise<Result<CreatedForm, FormsError>> {
    if (accessToken === this.setup.withoutScope) {
      return Promise.resolve(err({ code: 'insufficient_scope' }));
    }
    if (accessToken !== this.setup.accessToken)
      return Promise.resolve(err({ code: 'unauthorized' }));
    this.quizzes.push(quiz);
    const id = `form-${String(this.quizzes.length)}`;
    return Promise.resolve(
      ok({
        id,
        editUrl: `https://forms.test/${id}/edit`,
        responderUrl: `https://forms.test/${id}/viewform`,
      }),
    );
  }
}

/** Keeps what it uploads; it can be set to fail as Google would. */
export class FakeGoogleDrive implements GoogleDriveFiles {
  readonly uploads: { readonly name: string; readonly bytes: Uint8Array }[] = [];

  constructor(
    private readonly setup: {
      readonly accessToken: string;
      readonly failWith?: ClassroomError['code'];
    } = { accessToken: 'classroom-access' },
  ) {}

  uploadWordDocument(
    accessToken: string,
    file: { readonly name: string; readonly bytes: Uint8Array },
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    if (accessToken !== this.setup.accessToken)
      return Promise.resolve(err({ code: 'unauthorized' }));
    if (this.setup.failWith !== undefined)
      return Promise.resolve(err({ code: this.setup.failWith }));
    this.uploads.push(file);
    const id = `doc-${String(this.uploads.length)}`;
    return Promise.resolve(ok({ id, url: `https://docs.test/${id}/edit` }));
  }
}
