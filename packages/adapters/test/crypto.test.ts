import { describe, expect, it } from 'vitest';
import {
  clockContract,
  idGeneratorContract,
  passwordHasherContract,
  randomTokenGeneratorContract,
  tokenHasherContract,
} from '@thp/testing';
import {
  NodeRandomTokenGenerator,
  ScryptPasswordHasher,
  Sha256TokenHasher,
  SystemClock,
  UuidIdGenerator,
} from '../src/crypto/index.ts';

passwordHasherContract('ScryptPasswordHasher', () => new ScryptPasswordHasher());
tokenHasherContract('Sha256TokenHasher', () => new Sha256TokenHasher());
randomTokenGeneratorContract('NodeRandomTokenGenerator', () => new NodeRandomTokenGenerator());
idGeneratorContract('UuidIdGenerator', () => new UuidIdGenerator());
clockContract('SystemClock', () => new SystemClock());

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('asks to rehash a password stored with the old bcrypt scheme, which it cannot verify yet', async () => {
    const bcrypt = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Yz7Q8n0qQnP5r3x2m5eR4B0J5yFq5e';

    expect(hasher.needsRehash(bcrypt)).toBe(true);
    expect(await hasher.verify('anything', bcrypt)).toBe(false);
  });

  it('refuses a damaged hash instead of throwing', async () => {
    expect(await hasher.verify('pw', 'scrypt$16384$8$1$not-base64!')).toBe(false);
    expect(await hasher.verify('pw', 'scrypt$x$y$z$abc$def')).toBe(false);
  });

  it('asks to rehash a scrypt hash made with weaker settings', async () => {
    const weak = new ScryptPasswordHasher({ cost: 1024 });
    expect(hasher.needsRehash(await weak.hash('correct horse'))).toBe(true);
  });
});

describe('Sha256TokenHasher', () => {
  it('produces a hex SHA-256 digest', async () => {
    expect(await new Sha256TokenHasher().hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
