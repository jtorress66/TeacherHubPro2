import { describe, expect, it } from 'vitest';
import { startSession, type SchoolId, type UserId } from '@thp/domain';
import type { PasswordCredentialRepository, SessionRepository } from '@thp/ports';

/**
 * Account contracts. They use users `teacher-1` and `teacher-2` of school `school-a`;
 * a database-backed run must create those users first.
 */
const schoolId = 'school-a' as SchoolId;
const ana = 'teacher-1' as UserId;
const ben = 'teacher-2' as UserId;
const now = new Date('2026-09-01T08:00:00.000Z');
const session = (tokenHash: string, userId = ana) =>
  startSession({ tokenHash, userId, schoolId, now });

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
