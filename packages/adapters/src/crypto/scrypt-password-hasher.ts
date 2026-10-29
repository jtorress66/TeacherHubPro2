import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { PasswordHasher } from '@thp/ports';

const keyLength = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * Passwords hashed with scrypt from Node's standard library: `scrypt$N$r$p$salt$hash`.
 * Anything else (such as bcrypt hashes migrated from the old app) needs a rehash.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  private readonly cost: number;
  private readonly blockSize = 8;
  private readonly parallelism = 1;

  constructor(options: { readonly cost?: number } = {}) {
    this.cost = options.cost ?? 16384;
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(
      password,
      salt,
      this.options(this.cost, this.blockSize, this.parallelism),
    );
    return [
      'scrypt',
      this.cost,
      this.blockSize,
      this.parallelism,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const parsed = parse(hash);
    if (parsed === null) return false;
    try {
      const key = await derive(
        password,
        parsed.salt,
        this.options(parsed.cost, parsed.blockSize, parsed.parallelism),
      );
      return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    const parsed = parse(hash);
    if (parsed === null) return true;
    return (
      parsed.cost !== this.cost ||
      parsed.blockSize !== this.blockSize ||
      parsed.parallelism !== this.parallelism
    );
  }

  private options(cost: number, blockSize: number, parallelism: number): ScryptOptions {
    return { N: cost, r: blockSize, p: parallelism, maxmem: 256 * cost * blockSize };
  }
}

interface ParsedHash {
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelism: number;
  readonly salt: Buffer;
  readonly key: Buffer;
}

function parse(hash: string): ParsedHash | null {
  const [scheme, cost, blockSize, parallelism, salt, key, ...rest] = hash.split('$');
  if (scheme !== 'scrypt' || salt === undefined || key === undefined || rest.length > 0)
    return null;
  const numbers = [cost, blockSize, parallelism].map(Number);
  if (!numbers.every((n) => Number.isInteger(n) && n > 0)) return null;
  const [n, r, p] = numbers as [number, number, number];
  return {
    cost: n,
    blockSize: r,
    parallelism: p,
    salt: Buffer.from(salt, 'base64'),
    key: Buffer.from(key, 'base64'),
  };
}
