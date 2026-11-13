import { describe, expect, it } from 'vitest';
import type {
  ClassId,
  LtiCourse,
  LtiPlatform,
  LtiPlatformId,
  SchoolId,
  StudentId,
  UserId,
} from '@thp/domain';
import type {
  LtiCourseRepository,
  LtiMembershipsClient,
  LtiMembershipsError,
  LtiNonceRepository,
  LtiPlatformRepository,
  LtiStudentLinkRepository,
  LtiTokenVerifier,
  LtiUserLinkRepository,
  StudentRepository,
  ToolJwtSigner,
  ToolKeyStore,
} from '@thp/ports';
import { anLtiPlatform } from '../fixtures.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher = 'teacher-1' as UserId;
const colleague = 'teacher-2' as UserId;

export interface LtiRepositories {
  readonly platforms: LtiPlatformRepository;
  readonly nonces: LtiNonceRepository;
  readonly userLinks: LtiUserLinkRepository;
}

/** Needs schools `school-a` and `school-b`, and users `teacher-1` and `teacher-2` in school A. */
export function ltiRepositoryContract(name: string, make: () => LtiRepositories): void {
  describe(`${name} (LTI repositories)`, () => {
    it('finds a platform by id only within its school', async () => {
      const { platforms } = make();
      const platform = anLtiPlatform({ schoolId: schoolA });
      await platforms.save(platform);

      expect(await platforms.findById(schoolA, platform.id)).toEqual(platform);
      expect(await platforms.findById(schoolB, platform.id)).toBeNull();
      expect(await platforms.findById(schoolA, 'other' as LtiPlatformId)).toBeNull();
    });

    it('finds platforms by issuer across schools, narrowed by client ID when given', async () => {
      const { platforms } = make();
      const first = anLtiPlatform({ id: 'p1' as LtiPlatformId, schoolId: schoolA });
      const second = anLtiPlatform({
        id: 'p2' as LtiPlatformId,
        schoolId: schoolB,
        clientId: 'client-2',
        deploymentIds: ['d2', 'd3'],
      });
      await platforms.save(first);
      await platforms.save(second);

      const both = await platforms.findByIssuer(first.issuer, null);
      expect([...both].sort((a, b) => a.id.localeCompare(b.id))).toEqual([first, second]);
      expect(await platforms.findByIssuer(first.issuer, 'client-2')).toEqual([second]);
      expect(await platforms.findByIssuer(first.issuer, 'client-9')).toEqual([]);
      expect(await platforms.findByIssuer('https://other.example', null)).toEqual([]);
    });

    it('lists a school’s platforms, oldest first, and deletes only within the school', async () => {
      const { platforms } = make();
      const older = anLtiPlatform({
        id: 'p1' as LtiPlatformId,
        schoolId: schoolA,
        createdAt: new Date('2026-11-01T00:00:00Z'),
      });
      const newer = anLtiPlatform({
        id: 'p2' as LtiPlatformId,
        schoolId: schoolA,
        clientId: 'client-2',
        createdAt: new Date('2026-11-02T00:00:00Z'),
      });
      await platforms.save(newer);
      await platforms.save(older);
      expect(await platforms.listForSchool(schoolA)).toEqual([older, newer]);
      expect(await platforms.listForSchool(schoolB)).toEqual([]);

      await platforms.delete(schoolB, older.id);
      expect(await platforms.findById(schoolA, older.id)).toEqual(older);
      await platforms.delete(schoolA, older.id);
      expect(await platforms.listForSchool(schoolA)).toEqual([newer]);
    });

    it('lets a nonce be used once', async () => {
      const { nonces } = make();
      const expiresAt = new Date('2099-01-01T00:00:00Z');

      expect(await nonces.claim('nonce-1', expiresAt)).toBe(true);
      expect(await nonces.claim('nonce-1', expiresAt)).toBe(false);
      expect(await nonces.claim('nonce-2', expiresAt)).toBe(true);
    });

    it('links a course system user to one account, replacing an earlier link', async () => {
      const { platforms, userLinks } = make();
      const platform = anLtiPlatform({ schoolId: schoolA });
      await platforms.save(platform);
      const at = new Date('2026-11-12T12:00:00Z');

      expect(await userLinks.findUserId(platform.id, 'sub-1')).toBeNull();
      await userLinks.link(platform.id, 'sub-1', teacher, at);
      expect(await userLinks.findUserId(platform.id, 'sub-1')).toBe(teacher);
      expect(await userLinks.findUserId(platform.id, 'sub-2')).toBeNull();

      await userLinks.link(platform.id, 'sub-1', colleague, at);
      expect(await userLinks.findUserId(platform.id, 'sub-1')).toBe(colleague);
    });

    it('forgets the links of a removed platform', async () => {
      const { platforms, userLinks } = make();
      const platform = anLtiPlatform({ schoolId: schoolA });
      await platforms.save(platform);
      await userLinks.link(platform.id, 'sub-1', teacher, new Date('2026-11-12T12:00:00Z'));

      await platforms.delete(schoolA, platform.id);

      expect(await userLinks.findUserId(platform.id, 'sub-1')).toBeNull();
    });
  });
}

/** Signs launch tokens the verifier under test should (or should not) accept. */
export interface LtiTokenIssuer {
  readonly jwksUrl: string;
  /** A token signed with the platform's key. */
  sign(claims: Readonly<Record<string, unknown>>): Promise<string>;
  /** A token signed with some other key. */
  signWithOtherKey(claims: Readonly<Record<string, unknown>>): Promise<string>;
}

export function ltiTokenVerifierContract(
  name: string,
  make: () => { readonly verifier: LtiTokenVerifier; readonly issuer: LtiTokenIssuer },
): void {
  const issuer = 'https://lms.example.edu';
  const audience = 'client-1';
  const seconds = () => Math.floor(Date.now() / 1000);
  const claims = (overrides: Record<string, unknown> = {}) => ({
    iss: issuer,
    aud: audience,
    sub: 'user-1',
    iat: seconds(),
    exp: seconds() + 300,
    nonce: 'nonce-1',
    ...overrides,
  });

  describe(`${name} (LtiTokenVerifier contract)`, () => {
    it('accepts a token signed by the platform and returns its claims', async () => {
      const { verifier, issuer: platform } = make();
      const token = await platform.sign(claims());

      const verified = await verifier.verify(token, {
        jwksUrl: platform.jwksUrl,
        issuer,
        audience,
      });

      expect(verified.ok && verified.value).toMatchObject({ iss: issuer, sub: 'user-1' });
    });

    it('accepts an audience list that names the tool', async () => {
      const { verifier, issuer: platform } = make();
      const token = await platform.sign(claims({ aud: [audience, 'other'], azp: audience }));

      const verified = await verifier.verify(token, {
        jwksUrl: platform.jwksUrl,
        issuer,
        audience,
      });

      expect(verified.ok).toBe(true);
    });

    it.each([
      ['another key', (p: LtiTokenIssuer) => p.signWithOtherKey(claims())],
      ['another issuer', (p: LtiTokenIssuer) => p.sign(claims({ iss: 'https://evil.example' }))],
      ['another audience', (p: LtiTokenIssuer) => p.sign(claims({ aud: 'client-2' }))],
      ['an expired token', (p: LtiTokenIssuer) => p.sign(claims({ exp: seconds() - 120 }))],
      ['garbage', () => Promise.resolve('not.a.token')],
      ['an empty token', () => Promise.resolve('')],
    ])('refuses %s', async (_case, tokenFor) => {
      const { verifier, issuer: platform } = make();

      const verified = await verifier.verify(await tokenFor(platform), {
        jwksUrl: platform.jwksUrl,
        issuer,
        audience,
      });

      expect(verified).toEqual({ ok: false, error: 'invalid_token' });
    });
  });
}

export function toolKeyStoreContract(name: string, make: () => ToolKeyStore): void {
  describe(`${name} (ToolKeyStore contract)`, () => {
    it('makes a signing key on first use and keeps publishing the same one', async () => {
      const store = make();

      const first = await store.publicKeySet();
      const again = await store.publicKeySet();

      expect(first.keys).toHaveLength(1);
      expect(again).toEqual(first);
      expect(first.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
      expect(first.keys[0]?.kid).toMatch(/^[A-Za-z0-9_-]{16,}$/u);
    });

    it('publishes only the public half of the key', async () => {
      const [key] = (await make().publicKeySet()).keys;

      for (const secret of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
        expect(key).not.toHaveProperty(secret);
      }
    });
  });
}

const decodePart = (part: string | undefined): unknown =>
  JSON.parse(Buffer.from(part ?? '', 'base64url').toString('utf8'));

export function toolJwtSignerContract(
  name: string,
  make: () => ToolKeyStore & ToolJwtSigner,
): void {
  describe(`${name} (ToolJwtSigner contract)`, () => {
    it('signs the claims with RS256 under the published key’s id', async () => {
      const store = make();
      const claims = { iss: 'client-1', sub: 'client-1', aud: 'https://lms.example.edu/token' };

      const [header, payload, signature] = (await store.sign(claims)).split('.');
      const { keys } = await store.publicKeySet();

      expect(decodePart(header)).toMatchObject({ alg: 'RS256', kid: keys[0]?.kid });
      expect(decodePart(payload)).toEqual(claims);
      expect(signature).not.toBe('');
      expect(keys).toHaveLength(1);
    });
  });
}

const course = (overrides: Partial<LtiCourse> = {}): LtiCourse => ({
  platformId: 'lti-platform-1' as LtiPlatformId,
  schoolId: schoolA,
  teacherId: teacher,
  contextId: 'course-1',
  title: 'Science 5',
  membershipsUrl: 'https://lms.example.edu/courses/1/names_and_roles',
  lastLaunchedAt: new Date('2026-11-12T12:00:00Z'),
  ...overrides,
});

export interface LtiRosterRepositories {
  readonly platforms: LtiPlatformRepository;
  readonly courses: LtiCourseRepository;
  readonly studentLinks: LtiStudentLinkRepository;
  readonly students: StudentRepository;
}

const classOne = 'class-1' as ClassId;
const classTwo = 'class-2' as ClassId;
const studentOne = 'student-1' as StudentId;
const studentTwo = 'student-two' as StudentId;

/**
 * Needs schools `school-a` and `school-b`, users `teacher-1` and `teacher-2` in school A, classes
 * `class-1` and `class-2` in school A, and students `student-1` and `student-two` in `class-1`.
 */
export function ltiRosterRepositoryContract(name: string, make: () => LtiRosterRepositories): void {
  async function withPlatform(): Promise<LtiRosterRepositories & { platform: LtiPlatform }> {
    const repos = make();
    const platform = anLtiPlatform({ schoolId: schoolA });
    await repos.platforms.save(platform);
    return { ...repos, platform };
  }

  describe(`${name} (LTI roster repositories)`, () => {
    it('remembers a teacher’s course, and updates it on the next launch', async () => {
      const { courses } = await withPlatform();
      const first = course();
      await courses.save(first);
      expect(await courses.find(schoolA, teacher, first.platformId, 'course-1')).toEqual(first);

      const later = course({
        title: 'Science 5 (spring)',
        membershipsUrl: null,
        lastLaunchedAt: new Date('2026-11-13T12:00:00Z'),
      });
      await courses.save(later);

      expect(await courses.find(schoolA, teacher, first.platformId, 'course-1')).toEqual(later);
      expect(await courses.listForTeacher(schoolA, teacher)).toEqual([later]);
    });

    it('lists only the teacher’s own courses, most recently opened first', async () => {
      const { courses } = await withPlatform();
      const older = course({ contextId: 'course-1' });
      const newer = course({
        contextId: 'course-2',
        lastLaunchedAt: new Date('2026-11-13T12:00:00Z'),
      });
      const colleagues = course({ contextId: 'course-1', teacherId: colleague });
      await courses.save(older);
      await courses.save(newer);
      await courses.save(colleagues);

      expect(await courses.listForTeacher(schoolA, teacher)).toEqual([newer, older]);
      expect(await courses.listForTeacher(schoolA, colleague)).toEqual([colleagues]);
      expect(await courses.listForTeacher(schoolB, teacher)).toEqual([]);
      expect(await courses.find(schoolB, teacher, older.platformId, 'course-1')).toBeNull();
      expect(await courses.find(schoolA, teacher, older.platformId, 'course-9')).toBeNull();
    });

    it('forgets the courses of a removed course system', async () => {
      const { platforms, courses, platform } = await withPlatform();
      await courses.save(course());

      await platforms.delete(schoolA, platform.id);

      expect(await courses.listForTeacher(schoolA, teacher)).toEqual([]);
      expect(await courses.find(schoolA, teacher, platform.id, 'course-1')).toBeNull();
    });

    it('links students to course system users, class by class', async () => {
      const { studentLinks, platform } = await withPlatform();
      expect(await studentLinks.listForClass(schoolA, classOne, platform.id)).toEqual([]);

      await studentLinks.link(schoolA, platform.id, 'lms-1', studentOne);
      await studentLinks.link(schoolA, platform.id, 'lms-2', studentTwo);

      const links = await studentLinks.listForClass(schoolA, classOne, platform.id);
      expect([...links].sort((a, b) => a.subject.localeCompare(b.subject))).toEqual([
        { subject: 'lms-1', studentId: studentOne },
        { subject: 'lms-2', studentId: studentTwo },
      ]);
      expect(await studentLinks.listForClass(schoolA, classTwo, platform.id)).toEqual([]);
    });

    it('replaces a student’s link', async () => {
      const { studentLinks, platform } = await withPlatform();
      await studentLinks.link(schoolA, platform.id, 'lms-1', studentOne);

      await studentLinks.link(schoolA, platform.id, 'lms-9', studentOne);

      expect(await studentLinks.listForClass(schoolA, classOne, platform.id)).toEqual([
        { subject: 'lms-9', studentId: studentOne },
      ]);
    });

    it('never links or shows students of another school', async () => {
      const { studentLinks, platform } = await withPlatform();
      await studentLinks.link(schoolB, platform.id, 'lms-1', studentOne);
      expect(await studentLinks.listForClass(schoolA, classOne, platform.id)).toEqual([]);

      await studentLinks.link(schoolA, platform.id, 'lms-1', studentOne);
      expect(await studentLinks.listForClass(schoolB, classOne, platform.id)).toEqual([]);
    });

    it('forgets links when their course system or student is removed', async () => {
      const { platforms, students, studentLinks, platform } = await withPlatform();
      await studentLinks.link(schoolA, platform.id, 'lms-1', studentOne);
      await studentLinks.link(schoolA, platform.id, 'lms-2', studentTwo);

      await students.delete(schoolA, studentTwo);
      expect(await studentLinks.listForClass(schoolA, classOne, platform.id)).toEqual([
        { subject: 'lms-1', studentId: studentOne },
      ]);

      await platforms.delete(schoolA, platform.id);
      expect(await studentLinks.listForClass(schoolA, classOne, platform.id)).toEqual([]);
      expect(await students.findById(schoolA, studentOne)).not.toBeNull();
    });
  });
}

/** A course system serving one class list, or refusing it. */
export interface MembershipsSetup {
  readonly members: readonly unknown[];
  readonly refusal?: LtiMembershipsError;
}

export function ltiMembershipsClientContract(
  name: string,
  make: (setup: MembershipsSetup) => {
    readonly client: LtiMembershipsClient;
    readonly platform: LtiPlatform;
    readonly membershipsUrl: string;
  },
): void {
  const members = [
    { user_id: 'lms-1', roles: ['Learner'], given_name: 'Ana', family_name: 'Rivera' },
    { user_id: 'lms-2', roles: ['Instructor'], name: 'Ben Ortiz', status: 'Active' },
  ];

  describe(`${name} (LtiMembershipsClient contract)`, () => {
    it('returns every member of the class list as the course system sent them', async () => {
      const { client, platform, membershipsUrl } = make({ members });

      expect(await client.listMembers(platform, membershipsUrl)).toEqual({
        ok: true,
        value: members,
      });
    });

    it('returns an empty class list as empty', async () => {
      const { client, platform, membershipsUrl } = make({ members: [] });

      expect(await client.listMembers(platform, membershipsUrl)).toEqual({ ok: true, value: [] });
    });

    it.each(['not_allowed', 'unavailable'] as const)(
      'reports a course system that answers %s',
      async (refusal) => {
        const { client, platform, membershipsUrl } = make({ members, refusal });

        expect(await client.listMembers(platform, membershipsUrl)).toEqual({
          ok: false,
          error: refusal,
        });
      },
    );
  });
}
