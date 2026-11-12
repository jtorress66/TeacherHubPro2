import { describe, expect, it } from 'vitest';
import {
  issueEmailConfirmation,
  useEmailConfirmation,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type {
  AiUsageStats,
  BlockedDomainRepository,
  EmailConfirmationRepository,
  JobQueue,
  SchoolRepository,
  UserDirectory,
  UserRepository,
} from '@thp/ports';
import { aSchool, aUser } from '../fixtures.ts';

/** The account-protection ports with the repositories a test writes its own rows through. */
export interface AccountProtectionSetup {
  readonly emailConfirmations: EmailConfirmationRepository;
  readonly blockedDomains: BlockedDomainRepository;
  readonly aiUsage: AiUsageStats;
  readonly jobs: JobQueue;
  readonly schools: SchoolRepository;
  readonly users: UserRepository;
  readonly userDirectory: UserDirectory;
}

const schoolA = 'prot-school-a' as SchoolId;
const schoolB = 'prot-school-b' as SchoolId;

async function seed(setup: AccountProtectionSetup) {
  await setup.schools.save(aSchool({ id: schoolA, name: 'Alpha' }));
  await setup.schools.save(aSchool({ id: schoolB, name: 'Beta' }));
  const ana = aUser({ id: 'prot-ana' as UserId, schoolId: schoolA, email: 'ana@alpha.edu' });
  const ben = aUser({ id: 'prot-ben' as UserId, schoolId: schoolB, email: 'ben@kids.alpha.edu' });
  const cy = aUser({ id: 'prot-cy' as UserId, schoolId: schoolB, email: 'cy@myalpha.edu' });
  for (const user of [ana, ben, cy]) await setup.users.save(user);
  return { ana, ben, cy };
}

const now = new Date('2026-11-11T12:00:00Z');

/** Shared suites for email confirmations, blocked domains and AI use. */
export function accountProtectionContract(name: string, make: () => AccountProtectionSetup): void {
  describe(`${name} (EmailConfirmationRepository)`, () => {
    it('finds a link by its hash with the account’s school, and keeps only the newest usable', async () => {
      const setup = make();
      const { ana } = await seed(setup);
      const first = issueEmailConfirmation({ userId: ana.id, tokenHash: 'conf-1', now });
      await setup.emailConfirmations.save(first);
      expect(await setup.emailConfirmations.findByHash('conf-1')).toEqual({
        confirmation: first,
        schoolId: schoolA,
      });
      expect(await setup.emailConfirmations.findByHash('nope')).toBeNull();

      const later = new Date('2026-11-11T13:00:00Z');
      await setup.emailConfirmations.revokeFor(ana.id, later);
      expect((await setup.emailConfirmations.findByHash('conf-1'))?.confirmation.usedAt).toEqual(
        later,
      );
    });

    it('saves a used link', async () => {
      const setup = make();
      const { ana } = await seed(setup);
      const issued = issueEmailConfirmation({ userId: ana.id, tokenHash: 'conf-2', now });
      await setup.emailConfirmations.save(issued);
      await setup.emailConfirmations.save(useEmailConfirmation(issued, now));
      expect((await setup.emailConfirmations.findByHash('conf-2'))?.confirmation.usedAt).toEqual(
        now,
      );
    });
  });

  describe(`${name} (BlockedDomainRepository)`, () => {
    it('adds, lists by domain and removes blocked domains', async () => {
      const setup = make();
      const { ana } = await seed(setup);
      await setup.blockedDomains.save({ domain: 'kids.test', createdAt: now, createdBy: ana.id });
      await setup.blockedDomains.save({ domain: 'bad.example', createdAt: now, createdBy: null });
      await setup.blockedDomains.save({ domain: 'kids.test', createdAt: now, createdBy: null });
      expect(await setup.blockedDomains.list()).toEqual([
        { domain: 'bad.example', createdAt: now, createdBy: null },
        { domain: 'kids.test', createdAt: now, createdBy: ana.id },
      ]);
      expect(await setup.blockedDomains.remove('kids.test')).toBe(true);
      expect(await setup.blockedDomains.remove('kids.test')).toBe(false);
      expect((await setup.blockedDomains.list()).map((b) => b.domain)).toEqual(['bad.example']);
    });
  });

  describe(`${name} (UserDirectory by email domain)`, () => {
    it('lists everyone at a domain or its subdomains, across schools', async () => {
      const setup = make();
      const { ana, ben } = await seed(setup);
      const ids = (await setup.userDirectory.listByEmailDomain('alpha.edu')).map((u) => u.id);
      expect([...ids].sort()).toEqual([ana.id, ben.id].sort());
      expect(await setup.userDirectory.listByEmailDomain('nobody.edu')).toEqual([]);
    });
  });

  describe(`${name} (AiUsageStats)`, () => {
    it('counts each account’s AI jobs since a time', async () => {
      const setup = make();
      const { ana, ben } = await seed(setup);
      const job = (ownerId: UserId, schoolId: SchoolId) =>
        setup.jobs.enqueue({ schoolId, ownerId, kind: 'assistant.generate', payload: {} });
      await job(ana.id, schoolA);
      await job(ana.id, schoolA);
      await job(ben.id, schoolB);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const usage = await setup.aiUsage.draftsSince(since);
      expect([...usage].sort((a, b) => a.userId.localeCompare(b.userId))).toEqual([
        { userId: ana.id, drafts: 2 },
        { userId: ben.id, drafts: 1 },
      ]);
      expect(await setup.aiUsage.draftsSince(new Date(Date.now() + 60 * 60 * 1000))).toEqual([]);
    });
  });
}
