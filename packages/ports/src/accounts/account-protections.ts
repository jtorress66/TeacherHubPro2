import type { EmailConfirmation, SchoolId, UserId } from '@thp/domain';

/** A stored confirmation with the school its account belongs to now. */
export interface FoundEmailConfirmation {
  readonly confirmation: EmailConfirmation;
  readonly schoolId: SchoolId;
}

/** One-time "confirm your email" links, stored only as hashes. */
export interface EmailConfirmationRepository {
  save(confirmation: EmailConfirmation): Promise<void>;
  findByHash(tokenHash: string): Promise<FoundEmailConfirmation | null>;
  /** Marks every unused link of the user as used, so only the newest one works. */
  revokeFor(userId: UserId, now: Date): Promise<void>;
}

export interface BlockedDomain {
  /** Lower case, without @. */
  readonly domain: string;
  readonly createdAt: Date;
  /** The super admin who blocked it; null once their account is gone. */
  readonly createdBy: UserId | null;
}

/** Email domains that may not sign up, for super admins; the use cases decide who may call it. */
export interface BlockedDomainRepository {
  /** By domain. */
  list(): Promise<readonly BlockedDomain[]>;
  /** Adds the domain, or keeps the one already there. */
  save(blocked: BlockedDomain): Promise<void>;
  /** False when it was not blocked. */
  remove(domain: string): Promise<boolean>;
}

export interface AiUsage {
  readonly userId: UserId;
  readonly drafts: number;
}

/** How many AI drafts (background AI jobs) each account started, for super admins. */
export interface AiUsageStats {
  /** Only accounts with at least one draft since then. */
  draftsSince(since: Date): Promise<readonly AiUsage[]>;
}
