import { describe, expect, it } from 'vitest';
import type { SchoolId } from '@thp/domain';
import type { BatchFindable, Deletable, SchoolOwned, ScopedRepository } from '@thp/ports';

export interface ListMethod<T extends SchoolOwned, R> {
  readonly name: string;
  /** Calls the list method so that `entity` should be in the result for `schoolId`. */
  readonly call: (repository: R, schoolId: SchoolId, entity: T) => Promise<readonly T[]>;
}

export interface ScopedRepositoryContract<T extends SchoolOwned, R extends ScopedRepository<T>> {
  readonly make: () => R;
  /** A valid entity with this id, owned by this school. */
  readonly sample: (schoolId: SchoolId, id: string) => T;
  /** The same entity with a visible change. */
  readonly change: (entity: T) => T;
  readonly lists?: readonly ListMethod<T, R>[];
}

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

/** Shared suite every school-scoped repository must pass. */
export function scopedRepositoryContract<T extends SchoolOwned, R extends ScopedRepository<T>>(
  name: string,
  { make, sample, change, lists = [] }: ScopedRepositoryContract<T, R>,
): void {
  describe(`${name} (scoped repository contract)`, () => {
    it('finds what was saved', async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      await repository.save(entity);

      expect(await repository.findById(schoolA, entity.id)).toEqual(entity);
    });

    it('saving again replaces the stored entity', async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      await repository.save(entity);
      await repository.save(change(entity));

      expect(await repository.findById(schoolA, entity.id)).toEqual(change(entity));
    });

    it('returns null for an unknown id', async () => {
      expect(await make().findById(schoolA, 'missing')).toBeNull();
    });

    it("another school's data is unreachable", async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      await repository.save(entity);

      expect(await repository.findById(schoolB, entity.id)).toBeNull();
    });

    for (const list of lists) {
      it(`${list.name} returns the school's rows and never another school's`, async () => {
        const repository = make();
        const entity = sample(schoolA, 'one');
        const other = sample(schoolB, 'two');
        await repository.save(entity);
        await repository.save(other);

        expect(await list.call(repository, schoolA, entity)).toEqual([entity]);
        expect(await list.call(repository, schoolB, other)).toEqual([other]);
      });
    }
  });
}

/** Shared suite for repositories that allow deleting. */
export function deletableContract<
  T extends SchoolOwned,
  R extends ScopedRepository<T> & Deletable<T>,
>(name: string, { make, sample }: Pick<ScopedRepositoryContract<T, R>, 'make' | 'sample'>): void {
  describe(`${name} (deletable contract)`, () => {
    it('deletes within the school', async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      await repository.save(entity);
      await repository.delete(schoolA, entity.id);

      expect(await repository.findById(schoolA, entity.id)).toBeNull();
    });

    it("cannot delete another school's row", async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      await repository.save(entity);
      await repository.delete(schoolB, entity.id);

      expect(await repository.findById(schoolA, entity.id)).toEqual(entity);
    });
  });
}

/** Shared suite for repositories that read several rows at once. */
export function batchFindableContract<
  T extends SchoolOwned,
  R extends ScopedRepository<T> & BatchFindable<T>,
>(name: string, { make, sample }: Pick<ScopedRepositoryContract<T, R>, 'make' | 'sample'>): void {
  describe(`${name} (batch find contract)`, () => {
    it("finds the school's rows by id and leaves out unknown ids", async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      await repository.save(entity);

      expect(await repository.findByIds(schoolA, [entity.id, 'missing'])).toEqual([entity]);
    });

    it("never returns another school's rows", async () => {
      const repository = make();
      const entity = sample(schoolA, 'one');
      const other = sample(schoolB, 'two');
      await repository.save(entity);
      await repository.save(other);

      expect(await repository.findByIds(schoolA, [entity.id, other.id])).toEqual([entity]);
      expect(await repository.findByIds(schoolB, [entity.id, other.id])).toEqual([other]);
    });

    it('returns nothing for no ids', async () => {
      const repository = make();
      await repository.save(sample(schoolA, 'one'));

      expect(await repository.findByIds(schoolA, [])).toEqual([]);
    });
  });
}
