import type { EmailConfirmation, UserId } from '@thp/domain';
import type {
  AiUsage,
  AiUsageStats,
  BlockedDomain,
  BlockedDomainRepository,
  EmailConfirmationRepository,
  FoundEmailConfirmation,
} from '@thp/ports';
import type { InMemoryJobQueue } from './job-queue.ts';
import type { InMemoryUserRepository } from './repositories.ts';

/** Confirmation links by hash; the account's school comes from the user store, as a join would. */
export class InMemoryEmailConfirmationRepository implements EmailConfirmationRepository {
  private readonly rows = new Map<string, EmailConfirmation>();

  constructor(private readonly users: InMemoryUserRepository) {}

  save(confirmation: EmailConfirmation): Promise<void> {
    this.rows.set(confirmation.tokenHash, confirmation);
    return Promise.resolve();
  }

  findByHash(tokenHash: string): Promise<FoundEmailConfirmation | null> {
    const confirmation = this.rows.get(tokenHash);
    const user = this.users.all().find((u) => u.id === confirmation?.userId);
    return Promise.resolve(
      confirmation === undefined || user === undefined
        ? null
        : { confirmation, schoolId: user.schoolId },
    );
  }

  revokeFor(userId: UserId, now: Date): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.userId === userId && row.usedAt === null) {
        this.rows.set(row.tokenHash, { ...row, usedAt: now });
      }
    }
    return Promise.resolve();
  }

  /** Test helper: every stored link. */
  all(): readonly EmailConfirmation[] {
    return [...this.rows.values()];
  }
}

export class InMemoryBlockedDomainRepository implements BlockedDomainRepository {
  private readonly rows = new Map<string, BlockedDomain>();

  list(): Promise<readonly BlockedDomain[]> {
    return Promise.resolve(
      [...this.rows.values()].sort((a, b) => a.domain.localeCompare(b.domain)),
    );
  }

  save(blocked: BlockedDomain): Promise<void> {
    if (!this.rows.has(blocked.domain)) this.rows.set(blocked.domain, blocked);
    return Promise.resolve();
  }

  remove(domain: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(domain));
  }
}

/** Counts the in-memory queue's jobs per owner. */
export class InMemoryAiUsageStats implements AiUsageStats {
  constructor(private readonly jobs: InMemoryJobQueue) {}

  draftsSince(since: Date): Promise<readonly AiUsage[]> {
    const counts = new Map<UserId, number>();
    for (const job of this.jobs.all()) {
      if (job.createdAt >= since) counts.set(job.ownerId, (counts.get(job.ownerId) ?? 0) + 1);
    }
    return Promise.resolve([...counts].map(([userId, drafts]) => ({ userId, drafts })));
  }
}
