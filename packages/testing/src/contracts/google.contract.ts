import { describe, expect, it } from 'vitest';
import type {
  ClassroomCourse,
  ClassroomCourses,
  ClassroomAuthorization,
  ClassroomCoursework,
  ClassroomStudent,
  GoogleForms,
  GoogleIdentity,
  GoogleProfile,
} from '@thp/ports';
import type { FormsQuiz } from '@thp/domain';

export interface GoogleIdentitySetup {
  readonly identity: GoogleIdentity;
  /** A code this identity accepts for the profile. */
  readonly code: string;
}

export function googleIdentityContract(
  name: string,
  make: (profile: GoogleProfile) => GoogleIdentitySetup,
  profile: GoogleProfile,
): void {
  describe(`${name} (GoogleIdentity contract)`, () => {
    const redirectUri = 'https://app.test/api/auth/google/callback';

    it('exchanges a valid code for the profile', async () => {
      const { identity, code } = make(profile);
      expect(await identity.exchangeCode(code, redirectUri)).toEqual({ ok: true, value: profile });
    });

    it('rejects an invalid code', async () => {
      const { identity } = make(profile);
      expect(await identity.exchangeCode('not-a-real-code', redirectUri)).toEqual({
        ok: false,
        error: { code: 'invalid_code' },
      });
    });

    it('builds a sign-in address that carries the state and the return address', () => {
      const url = new URL(make(profile).identity.authorizationUrl('state-123', redirectUri));
      expect(url.protocol).toBe('https:');
      expect(url.searchParams.get('state')).toBe('state-123');
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    });
  });
}

export interface ClassroomFixture {
  readonly accessToken: string;
  readonly course: ClassroomCourse;
  readonly roster: readonly ClassroomStudent[];
}

export function classroomContract(
  name: string,
  make: (fixture: ClassroomFixture) => ClassroomCourses & ClassroomCoursework,
  fixture: ClassroomFixture,
): void {
  describe(`${name} (Classroom contracts)`, () => {
    it('lists courses and a course roster', async () => {
      const classroom = make(fixture);

      expect(await classroom.listCourses(fixture.accessToken)).toEqual({
        ok: true,
        value: [fixture.course],
      });
      expect(await classroom.listRoster(fixture.accessToken, fixture.course.id)).toEqual({
        ok: true,
        value: fixture.roster,
      });
    });

    it('rejects a bad access token and an unknown course', async () => {
      const classroom = make(fixture);

      expect(await classroom.listCourses('expired')).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
      expect(await classroom.listRoster(fixture.accessToken, 'nope')).toEqual({
        ok: false,
        error: { code: 'not_found' },
      });
    });

    it('creates coursework and returns its address', async () => {
      const result = await make(fixture).createCoursework(fixture.accessToken, fixture.course.id, {
        title: 'Quiz 1',
        description: 'Fractions',
        link: 'https://app.test/a/xyz',
        dueDate: null,
      });

      expect(result.ok && result.value.url.startsWith('https://')).toBe(true);
    });

    it('cannot create coursework without access', async () => {
      const result = await make(fixture).createCoursework('expired', fixture.course.id, {
        title: 'Quiz 1',
        description: '',
        link: 'https://app.test/a/xyz',
        dueDate: null,
      });

      expect(result).toEqual({ ok: false, error: { code: 'unauthorized' } });
    });
  });
}

export interface ClassroomAuthorizationSetup {
  readonly authorization: ClassroomAuthorization;
  /** A code this authorization accepts. */
  readonly code: string;
}

export function classroomAuthorizationContract(
  name: string,
  make: () => ClassroomAuthorizationSetup,
): void {
  describe(`${name} (ClassroomAuthorization contract)`, () => {
    const redirectUri = 'https://app.test/api/classroom/callback';

    it('builds a consent address that carries the state and the return address', () => {
      const url = new URL(make().authorization.authorizationUrl('state-9', redirectUri));
      expect(url.searchParams.get('state')).toBe('state-9');
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    });

    it('turns a valid code into a refresh token that yields access tokens', async () => {
      const { authorization, code } = make();
      const exchanged = await authorization.exchangeCode(code, redirectUri);
      if (!exchanged.ok) throw new Error('exchange failed');
      const access = await authorization.accessToken(exchanged.value.refreshToken);
      expect(access.ok && access.value.length > 0).toBe(true);
    });

    it('refuses an invalid code and an unknown refresh token', async () => {
      const { authorization } = make();
      expect(await authorization.exchangeCode('bad-code', redirectUri)).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
      expect(await authorization.accessToken('unknown-refresh')).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });
  });
}

const sampleQuiz: FormsQuiz = {
  title: 'Fractions quiz',
  description: 'Show your work.',
  items: [
    {
      kind: 'choice',
      title: '1/2 + 1/4?',
      description: null,
      points: 5,
      options: ['3/4', '2/6'],
      correct: ['3/4'],
    },
    { kind: 'text', title: 'Why?', description: null, points: 5, paragraph: true, correct: [] },
    { kind: 'grid', title: 'Match', description: 'Each once', rows: ['1/2'], columns: ['half'] },
  ],
};

export function googleFormsContract(
  name: string,
  make: (accessToken: string) => GoogleForms,
  accessToken: string,
): void {
  describe(`${name} (GoogleForms contract)`, () => {
    it('creates a quiz and returns where to edit it and where students answer it', async () => {
      const result = await make(accessToken).createQuiz(accessToken, sampleQuiz);
      if (!result.ok) throw new Error(`createQuiz failed: ${result.error.code}`);
      expect(result.value.id).not.toBe('');
      expect(result.value.editUrl.startsWith('https://')).toBe(true);
      expect(result.value.responderUrl.startsWith('https://')).toBe(true);
      expect(result.value.editUrl).not.toBe(result.value.responderUrl);
    });

    it('cannot create a quiz without access', async () => {
      expect(await make(accessToken).createQuiz('expired', sampleQuiz)).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });
  });
}
