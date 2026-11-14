import type { SchoolId } from '@thp/domain';

/** Anything owned by a school. */
export interface SchoolOwned {
  readonly id: string;
  readonly schoolId: SchoolId;
}

/**
 * Every read takes the caller's school first, so another school's rows are unreachable.
 * `save` inserts or replaces by id.
 */
export interface ScopedRepository<T extends SchoolOwned> {
  findById(schoolId: SchoolId, id: T['id']): Promise<T | null>;
  save(entity: T): Promise<void>;
}

/** For entities a teacher may delete outright. */
export interface Deletable<T extends SchoolOwned> {
  delete(schoolId: SchoolId, id: T['id']): Promise<void>;
}

/**
 * Several of a school's rows in one read. Ids that are unknown or belong to another school are
 * simply left out; the order of the result is not guaranteed.
 */
export interface BatchFindable<T extends SchoolOwned> {
  findByIds(schoolId: SchoolId, ids: readonly T['id'][]): Promise<readonly T[]>;
}
