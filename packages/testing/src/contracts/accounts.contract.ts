import { describe, expect, it } from 'vitest';
import { endSignInSession, startSession, type SchoolId, type UserId } from '@thp/domain';
import type { PasswordCredentialRepository, SessionRepository } from '@thp/ports';

/**
 * Account contracts. They use users `teacher-1` and `teacher-2` of school `school-a`;
 * a database-backed run must create those users first.
 */
const schoolId = 'school-a' as SchoolId;
const ana = 'teacher-1' as UserId;
const ben = 'teacher-2' as UserId;
const now = new Date('2026-09-01T08:00:00.000Z');
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const session = (tokenHash: string, userId = ana, at = now) =>
  startSession({
    tokenHash,
    userId,
    schoolId,
    device: { browser: 'edge', os: 'windows' },
    now: at,
  });
/** A session from before devices were recorded. */
const deviceless = (tokenHash: string) =>
  startSession({ tokenHash, userId: ana, schoolId, device: null, now });
const hashes = (sessions: readonly { readonly tokenHash: string }[]) =>
  sessions.map((s) => s.tokenHash).sort();

export function sessionRepositoryContract(name: string, make: () => SessionRepository): void {
  describe(`${name} (SessionRepository contract)`, () => {
    it('finds a session by its token hash', async () => {
      const sessions = make();
      await sessions.save(session('hash-1'));

      expect(await sessions.findByTokenHash('hash-1')).toEqual(session('hash-1'));
      expect(await sessions.findByTokenHash('hash-2')).toBeNull();
    });

    it('deletes one session', async () => {
      const sessions = make();
      await sessions.save(session('hash-1'));
      await sessions.delete('hash-1');

      expect(await sessions.findByTokenHash('hash-1')).toBeNull();
    });

    it("deletes all of one user's sessions and nobody else's", async () => {
      const sessions = make();
      await sessions.save(session('ana-phone'));
      await sessions.save(session('ana-laptop'));
      await sessions.save(session('ben-laptop', ben));
      await sessions.deleteAllForUser(ana);

      expect(await sessions.findByTokenHash('ana-phone')).toBeNull();
      expect(await sessions.findByTokenHash('ana-laptop')).toBeNull();
      expect(await sessions.findByTokenHash('ben-laptop')).toEqual(session('ben-laptop', ben));
    });

    it('keeps a session without a device as having none', async () => {
      const sessions = make();
      await sessions.save(deviceless('old'));

      expect(await sessions.findByTokenHash('old')).toEqual(deviceless('old'));
    });

    it("lists a user's active sessions, leaving out ended, expired and other users' ones", async () => {
      const sessions = make();
      await sessions.save(session('ana-phone'));
      await sessions.save(endSignInSession(session('ana-old'), 'replaced', now));
      await sessions.save(session('ana-expired', ana, new Date('2026-07-01T08:00:00.000Z')));
      await sessions.save(session('ben-laptop', ben));

      expect(hashes(await sessions.listActiveForUser(ana, later(1)))).toEqual(['ana-phone']);
    });

    it("ends a user's other sessions as tombstones and removes their expired ones", async () => {
      const sessions = make();
      await sessions.save(session('ana-phone'));
      await sessions.save(session('ana-tablet'));
      await sessions.save(session('ana-new', ana, later(10)));
      await sessions.save(session('ana-expired', ana, new Date('2026-07-01T08:00:00.000Z')));
      await sessions.save(session('ben-laptop', ben));

      await sessions.endAllForUserExcept(ana, 'ana-new', 'replaced', later(10));

      expect(await sessions.findByTokenHash('ana-phone')).toEqual(
        endSignInSession(session('ana-phone'), 'replaced', later(10)),
      );
      expect(await sessions.findByTokenHash('ana-tablet')).toMatchObject({
        endedReason: 'replaced',
      });
      expect(await sessions.findByTokenHash('ana-new')).toEqual(session('ana-new', ana, later(10)));
      expect(await sessions.findByTokenHash('ana-expired')).toBeNull();
      expect(await sessions.findByTokenHash('ben-laptop')).toEqual(session('ben-laptop', ben));
    });

    it('does not end a session again, so it keeps when it first ended', async () => {
      const sessions = make();
      await sessions.save(endSignInSession(session('ana-phone'), 'replaced', later(1)));

      await sessions.endAllForUserExcept(ana, 'ana-new', 'replaced', later(5));

      expect((await sessions.findByTokenHash('ana-phone'))?.endedAt).toEqual(later(1));
    });

    it('records activity on an active session only', async () => {
      const sessions = make();
      await sessions.save(session('ana-phone'));
      await sessions.save(endSignInSession(session('ana-old'), 'replaced', now));

      await sessions.touch('ana-phone', later(7));
      await sessions.touch('ana-old', later(7));
      await sessions.touch('nobody', later(7));

      expect((await sessions.findByTokenHash('ana-phone'))?.lastSeenAt).toEqual(later(7));
      expect((await sessions.findByTokenHash('ana-old'))?.lastSeenAt).toEqual(now);
      expect(await sessions.findByTokenHash('nobody')).toBeNull();
    });
  });
}

export function passwordCredentialRepositoryContract(
  name: string,
  make: () => PasswordCredentialRepository,
): void {
  describe(`${name} (PasswordCredentialRepository contract)`, () => {
    it('saves, replaces and finds a password hash by user', async () => {
      const credentials = make();
      await credentials.save({ userId: ana, passwordHash: 'scrypt$old' });
      await credentials.save({ userId: ana, passwordHash: 'scrypt$new' });

      expect(await credentials.findByUserId(ana)).toEqual({
        userId: ana,
        passwordHash: 'scrypt$new',
      });
      expect(await credentials.findByUserId(ben)).toBeNull();
    });
  });
}
