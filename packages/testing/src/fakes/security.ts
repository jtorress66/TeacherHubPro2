import { createHash } from 'node:crypto';
import type { PasswordHasher, RandomTokenGenerator, TokenHasher } from '@thp/ports';

/**
 * Fast, readable password "hashing" for tests: `fake$<salt>$<sha256>`.
 * Hashes starting with `legacy$` stand in for migrated accounts and ask to be rehashed.
 */
export class FakePasswordHasher implements PasswordHasher {
  private salts = 0;

  hash(password: string): Promise<string> {
    this.salts += 1;
    const salt = String(this.salts);
    return Promise.resolve(`fake$${salt}$${digest(salt + password)}`);
  }

  verify(password: string, hash: string): Promise<boolean> {
    if (hash.startsWith('legacy$')) return Promise.resolve(hash === `legacy$${password}`);
    const [scheme, salt, expected] = hash.split('$');
    return Promise.resolve(scheme === 'fake' && expected === digest(`${salt ?? ''}${password}`));
  }

  needsRehash(hash: string): boolean {
    return hash.startsWith('legacy$');
  }
}

export class FakeTokenHasher implements TokenHasher {
  hash(token: string): Promise<string> {
    return Promise.resolve(digest(token));
  }
}

/** Predictable link tokens: `token-000…1`, `token-000…2`, … */
export class SequentialTokenGenerator implements RandomTokenGenerator {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `token-${String(this.count).padStart(32, '0')}`;
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
