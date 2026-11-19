import type { SchoolDeletionRequest, SchoolId } from '@thp/domain';

/** Schools waiting out the hold before their data is deleted: one request per school. */
export interface SchoolDeletionRepository {
  findBySchool(schoolId: SchoolId): Promise<SchoolDeletionRequest | null>;
  save(request: SchoolDeletionRequest): Promise<void>;
  remove(schoolId: SchoolId): Promise<void>;
  /** Unscoped on purpose: the worker deletes every school whose hold is over. */
  listDue(now: Date): Promise<readonly SchoolDeletionRequest[]>;
}

/**
 * Deletes everything a school has (people, classes, students, work, files and its request) in one
 * go, and keeps only a proof of it made of IDs and dates.
 */
export interface SchoolEraser {
  erase(request: SchoolDeletionRequest, deletedAt: Date): Promise<void>;
}
