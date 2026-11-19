import type { SchoolDeletionRequest, SchoolId } from '@thp/domain';
import type { SchoolDeletionRepository, SchoolEraser } from '@thp/ports';

export class InMemorySchoolDeletionRepository implements SchoolDeletionRepository {
  private readonly requests = new Map<SchoolId, SchoolDeletionRequest>();

  findBySchool(schoolId: SchoolId): Promise<SchoolDeletionRequest | null> {
    return Promise.resolve(this.requests.get(schoolId) ?? null);
  }

  save(request: SchoolDeletionRequest): Promise<void> {
    this.requests.set(request.schoolId, request);
    return Promise.resolve();
  }

  remove(schoolId: SchoolId): Promise<void> {
    this.requests.delete(schoolId);
    return Promise.resolve();
  }

  listDue(now: Date): Promise<readonly SchoolDeletionRequest[]> {
    return Promise.resolve(
      [...this.requests.values()].filter((r) => r.deleteAfter.getTime() <= now.getTime()),
    );
  }
}

/** The proof a deletion keeps: IDs and dates only. */
export interface ErasedSchool {
  readonly schoolId: SchoolId;
  readonly requestedBy: SchoolDeletionRequest['requestedBy'];
  readonly requestedAt: Date;
  readonly deletedAt: Date;
}

/**
 * Stands in for the database's deletion: drops the school's request, calls `onErase` (tests use it
 * to clear their in-memory repositories) and keeps the ID-only proof in `erased`.
 */
export class FakeSchoolEraser implements SchoolEraser {
  readonly erased: ErasedSchool[] = [];

  constructor(
    private readonly deletions: SchoolDeletionRepository,
    private readonly onErase: (schoolId: SchoolId) => Promise<void> = () => Promise.resolve(),
  ) {}

  async erase(request: SchoolDeletionRequest, deletedAt: Date): Promise<void> {
    await this.onErase(request.schoolId);
    await this.deletions.remove(request.schoolId);
    this.erased.push({
      schoolId: request.schoolId,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deletedAt,
    });
  }
}
