import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Clock, IdGenerator, RandomTokenGenerator, TokenHasher } from '@thp/ports';

export { ScryptPasswordHasher } from './scrypt-password-hasher.ts';

/** SHA-256 of a link or session token. Tokens are long and random, so no salt is needed. */
export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): Promise<string> {
    return Promise.resolve(createHash('sha256').update(token).digest('hex'));
  }
}

/** 32 random bytes as URL-safe base64 (43 characters). */
export class NodeRandomTokenGenerator implements RandomTokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
