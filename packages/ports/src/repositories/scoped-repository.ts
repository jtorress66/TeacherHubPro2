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
