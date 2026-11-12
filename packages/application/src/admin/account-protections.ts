import {
  checkSuspension,
  ok,
  parseBlockedDomain,
  reinstate,
  suspend,
  type Result,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import type {
  BlockedDomain,
  BlockedDomainRepository,
  Clock,
  SessionRepository,
  UserDirectory,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { requireSuperAdmin } from './admin-access.ts';

interface Target {
  readonly actor: User;
  readonly schoolId: SchoolId;
  readonly userId: UserId;
}

interface SuspensionDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly clock: Clock;
}

/** Suspends an account and ends all its sessions, unless the rules forbid it. */
async function suspendAccount(
  deps: SuspensionDeps,
  actor: User,
  user: User,
): Promise<Result<User, UseCaseError>> {
  const allowed = checkSuspension(actor, user);
  if (!allowed.ok) return fail(allowed.error.code);
  const suspended = user.suspendedAt === null ? suspend(user, deps.clock.now()) : user;
  if (suspended !== user) await deps.users.save(suspended);
  await deps.sessions.deleteAllForUser(user.id);
  return ok(suspended);
}

/**
 * A super admin suspends an account: its sessions end and it can no longer sign in. Nobody
 * suspends themselves or another super admin.
 */
export class SuspendUser {
  constructor(private readonly deps: SuspensionDeps) {}

  async execute(input: Target): Promise<Result<User, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const user = await this.deps.users.findById(input.schoolId, input.userId);
    if (user === null) return fail('not_found');
    return suspendAccount(this.deps, input.actor, user);
  }
}

/** A super admin lets a suspended account sign in again. */
export class ReinstateUser {
  constructor(private readonly deps: { readonly users: UserRepository }) {}

  async execute(input: Target): Promise<Result<User, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const user = await this.deps.users.findById(input.schoolId, input.userId);
    if (user === null) return fail('not_found');
    const back = reinstate(user);
    await this.deps.users.save(back);
    return ok(back);
  }
}

export interface DomainBlocked {
  readonly domain: string;
  /** The accounts at the domain this suspended, for the page to list with Reinstate buttons. */
  readonly suspended: readonly User[];
}

/**
 * Blocks sign-ups from an email domain and its subdomains, and suspends the accounts already
 * there (never a super admin).
 */
export class BlockDomain {
  constructor(
    private readonly deps: SuspensionDeps & {
      readonly blockedDomains: BlockedDomainRepository;
      readonly userDirectory: UserDirectory;
    },
  ) {}

  async execute(input: {
    actor: User;
    domain: string;
  }): Promise<Result<DomainBlocked, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const domain = parseBlockedDomain(input.domain);
    if (!domain.ok) return domain;
    await this.deps.blockedDomains.save({
      domain: domain.value,
      createdAt: this.deps.clock.now(),
      createdBy: input.actor.id,
    });
    const suspended: User[] = [];
    for (const user of await this.deps.userDirectory.listByEmailDomain(domain.value)) {
      if (user.role === 'super_admin') continue;
      const done = await suspendAccount(this.deps, input.actor, user);
      if (done.ok) suspended.push(done.value);
    }
    return ok({ domain: domain.value, suspended });
  }
}

/** Lets a domain sign up again; accounts suspended with it stay suspended until reinstated. */
export class UnblockDomain {
  constructor(private readonly deps: { readonly blockedDomains: BlockedDomainRepository }) {}

  async execute(input: { actor: User; domain: string }): Promise<Result<true, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const domain = parseBlockedDomain(input.domain);
    if (!domain.ok) return domain;
    return (await this.deps.blockedDomains.remove(domain.value)) ? ok(true) : fail('not_found');
  }
}

export class ListBlockedDomains {
  constructor(private readonly deps: { readonly blockedDomains: BlockedDomainRepository }) {}

  async execute(input: { actor: User }): Promise<Result<readonly BlockedDomain[], UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    return ok(await this.deps.blockedDomains.list());
  }
}
