import { describe, expect, it } from 'vitest';
import type {
  ClassroomCourse,
  ClassroomCourses,
  ClassroomCoursework,
  ClassroomStudent,
  GoogleIdentity,
  GoogleProfile,
} from '@thp/ports';

export function googleIdentityContract(
  name: string,
  make: (code: string, profile: GoogleProfile) => GoogleIdentity,
  profile: GoogleProfile,
): void {
  describe(`${name} (GoogleIdentity contract)`, () => {
    it('exchanges a valid code for the profile', async () => {
      expect(
        await make('good-code', profile).exchangeCode('good-code', 'https://app.test/cb'),
      ).toEqual({
        ok: true,
        value: profile,
      });
    });

    it('rejects an invalid code', async () => {
      expect(
        await make('good-code', profile).exchangeCode('bad-code', 'https://app.test/cb'),
      ).toEqual({
        ok: false,
        error: { code: 'invalid_code' },
      });
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
