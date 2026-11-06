import type { PasswordToken, Role, School, SchoolId, User, UserId } from '@thp/domain';

/** Every school, for super admins; the use cases decide who may call it. */
export interface SchoolDirectory {
  /** By name. */
  listAll(): Promise<readonly School[]>;
  /** `in_use` while anyone or anything still belongs to the school. */
  delete(id: SchoolId): Promise<'deleted' | 'in_use' | 'not_found'>;
}

export interface UserSearch {
  readonly schoolId?: SchoolId;
  /** Part of a name or email, any case. */
  readonly text?: string;
  readonly limit: number;
}

/** Users across schools, for super admins and the first-admin setup. */
export interface UserDirectory {
  /** Newest first. */
  search(query: UserSearch): Promise<readonly User[]>;
  countByRole(role: Role): Promise<number>;
  /**
   * Removes the user with their own work (sessions, plans, folders, templates, presentations,
   * AI writing, jobs). `in_use` when school records still name them (grades they gave, a
   * subscription they own, games or live sessions), and nothing is removed.
   */
  delete(id: UserId): Promise<'deleted' | 'in_use' | 'not_found'>;
  /** Moves the user, with their own plans, folders, templates, presentations and AI writing. */
  moveToSchool(id: UserId, schoolId: SchoolId): Promise<void>;
}

export interface SchoolCounts {
  readonly schoolId: SchoolId;
  readonly users: number;
  readonly classes: number;
  readonly students: number;
}

export interface PlatformCounts {
  readonly schools: number;
  readonly users: Readonly<Record<Role, number>>;
  readonly classes: number;
  readonly students: number;
  readonly lessonPlans: number;
  readonly perSchool: readonly SchoolCounts[];
}

/** Platform-wide numbers for the super admin overview. */
export interface PlatformStats {
  counts(): Promise<PlatformCounts>;
}

/** One-time set-password links, stored as hashes. */
export interface PasswordTokenRepository {
  save(token: PasswordToken): Promise<void>;
  findByHash(tokenHash: string): Promise<PasswordToken | null>;
  /** Marks every unused link of the user as used, so only the newest one works. */
  revokeFor(userId: UserId, now: Date): Promise<void>;
}
