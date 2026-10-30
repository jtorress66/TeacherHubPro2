import { ok, type Result, type SchoolId, type User, type UserId } from '@thp/domain';
import { fail, type UseCaseError } from '../errors.ts';

interface Owned {
  readonly id: string;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
}

/**
 * A teacher's private item (an AI generation, a presentation). Anyone else, a school admin
 * included, gets not_found, so its existence is never revealed.
 */
export async function findOwned<T extends Owned>(
  repository: { findById(schoolId: SchoolId, id: T['id']): Promise<T | null> },
  actor: User,
  id: T['id'],
): Promise<Result<T, UseCaseError>> {
  const item = await repository.findById(actor.schoolId, id);
  return item?.teacherId === actor.id ? ok(item) : fail('not_found');
}
