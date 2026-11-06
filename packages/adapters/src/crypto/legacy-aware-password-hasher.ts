import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '@thp/ports';

const bcryptPrefix = /^\$2[aby]\$\d{2}\$/u;

/**
 * Accepts the bcrypt hashes migrated from the old app as well as the current scheme. Every
 * bcrypt hash asks for a rehash, so log-in quietly moves each account to the current scheme;
 * new hashes always come from the current hasher.
 */
export class LegacyAwarePasswordHasher implements PasswordHasher {
  constructor(private readonly current: PasswordHasher) {}

  hash(password: string): Promise<string> {
    return this.current.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    if (!bcryptPrefix.test(hash)) return this.current.verify(password, hash);
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return bcryptPrefix.test(hash) || this.current.needsRehash(hash);
  }
}
