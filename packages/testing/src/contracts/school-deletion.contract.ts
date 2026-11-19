import { describe, expect, it } from 'vitest';
import { requestSchoolDeletion, type SchoolId, type UserId } from '@thp/domain';
import type { SchoolDeletionRepository, SchoolEraser } from '@thp/ports';

/** Uses the shared fixtures: teacher-1 at school-a, and school-b as another school. */
const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher1 = 'teacher-1' as UserId;
const now = new Date('2026-11-19T12:00:00Z');
const day = 24 * 60 * 60 * 1000;

const requestFor = (schoolId: SchoolId, at = now) =>
  requestSchoolDeletion({ schoolId, requestedBy: teacher1, now: at });

export function schoolDeletionRepositoryContract(
  name: string,
  make: () => SchoolDeletionRepository,
): void {
  describe(`${name} (SchoolDeletionRepository contract)`, () => {
    it('keeps one request per school and finds it by school', async () => {
      const deletions = make();
      await deletions.save(requestFor(schoolA));

      expect(await deletions.findBySchool(schoolA)).toEqual(requestFor(schoolA));
      expect(await deletions.findBySchool(schoolB)).toBeNull();
    });

    it('replaces the request when the school asks again', async () => {
      const deletions = make();
      await deletions.save(requestFor(schoolA));
      const later = requestFor(schoolA, new Date(now.getTime() + day));
      await deletions.save(later);

      expect(await deletions.findBySchool(schoolA)).toEqual(later);
    });

    it('forgets a canceled request', async () => {
      const deletions = make();
      await deletions.save(requestFor(schoolA));
      await deletions.remove(schoolA);

      expect(await deletions.findBySchool(schoolA)).toBeNull();
    });

    it('lists only the requests whose hold is over', async () => {
      const deletions = make();
      await deletions.save(requestFor(schoolA));
      await deletions.save(requestFor(schoolB, new Date(now.getTime() + day)));

      const due = requestFor(schoolA).deleteAfter;
      expect(await deletions.listDue(new Date(due.getTime() - 1))).toEqual([]);
      expect(await deletions.listDue(due)).toEqual([requestFor(schoolA)]);
    });
  });
}

/** An eraser, with the request store it clears and test hooks to give a school data and look. */
export interface SchoolEraserSetup {
  readonly eraser: SchoolEraser;
  readonly deletions: SchoolDeletionRepository;
  /** Gives the school a person, a class, a student and their work. */
  readonly seed: (schoolId: SchoolId) => Promise<void>;
  readonly hasData: (schoolId: SchoolId) => Promise<boolean>;
}

export function schoolEraserContract(name: string, make: () => Promise<SchoolEraserSetup>): void {
  describe(`${name} (SchoolEraser contract)`, () => {
    it('deletes the school’s data and its request, and leaves other schools alone', async () => {
      const setup = await make();
      await setup.seed(schoolA);
      await setup.seed(schoolB);
      await setup.deletions.save(requestFor(schoolA));

      await setup.eraser.erase(requestFor(schoolA), now);

      expect(await setup.hasData(schoolA)).toBe(false);
      expect(await setup.deletions.findBySchool(schoolA)).toBeNull();
      expect(await setup.hasData(schoolB)).toBe(true);
    });

    it('does nothing more for a school that is already gone', async () => {
      const setup = await make();
      await setup.seed(schoolB);

      await setup.eraser.erase(requestFor(schoolA), now);

      expect(await setup.hasData(schoolB)).toBe(true);
    });
  });
}
