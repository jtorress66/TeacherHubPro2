import { describe, expect, it } from 'vitest';
import {
  clockContract,
  idGeneratorContract,
  passwordHasherContract,
  randomTokenGeneratorContract,
  seedSourceContract,
  ticketSignerContract,
  tokenHasherContract,
} from '@thp/testing';
import {
  CryptoSeedSource,
  LegacyAwarePasswordHasher,
  NodeRandomTokenGenerator,
  ScryptPasswordHasher,
  Sha256TokenHasher,
  SystemClock,
  UuidIdGenerator,
} from '../src/crypto/index.ts';
import { HmacTicketSigner } from '../src/crypto/hmac-ticket-signer.ts';

passwordHasherContract('ScryptPasswordHasher', () => new ScryptPasswordHasher());
/** A bcrypt hash as the old app's passlib stored it, made for this test. */
const oldBcrypt = {
  password: 'old password',
  hash: '$2b$04$VlRPCU7sTvBdEP.9jSdpt.z4Pom2//B8u6OA6M86187i6J/8Biuha',
};
passwordHasherContract(
  'LegacyAwarePasswordHasher',
  () => new LegacyAwarePasswordHasher(new ScryptPasswordHasher()),
  oldBcrypt,
);
tokenHasherContract('Sha256TokenHasher', () => new Sha256TokenHasher());
randomTokenGeneratorContract('NodeRandomTokenGenerator', () => new NodeRandomTokenGenerator());
idGeneratorContract('UuidIdGenerator', () => new UuidIdGenerator());
clockContract('SystemClock', () => new SystemClock());
seedSourceContract('CryptoSeedSource', () => new CryptoSeedSource());
ticketSignerContract('HmacTicketSigner', () => new HmacTicketSigner('x'.repeat(32)));

describe('HmacTicketSigner', () => {
  it('needs a secret of at least 32 characters', () => {
    expect(() => new HmacTicketSigner('short')).toThrow('at least 32');
  });

  it('refuses a ticket signed with another secret, or carrying a non-text payload', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    const later = new Date('2026-11-04T11:00:00Z');
    const ours = new HmacTicketSigner('a'.repeat(32));
    const theirs = new HmacTicketSigner('b'.repeat(32));
    expect(ours.verify(theirs.sign({ role: 'host' }, later), now)).toBeNull();
    const odd = `${Buffer.from('[1,2]').toString('base64url')}.${String(later.getTime())}`;
    const signature = ours.sign({ x: 'y' }, later).split('.')[2] ?? '';
    expect(ours.verify(`${odd}.${signature}`, now)).toBeNull();
  });
});

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

describe('LegacyAwarePasswordHasher', () => {
  const hasher = new LegacyAwarePasswordHasher(new ScryptPasswordHasher());

  it('rejects a wrong password for an old bcrypt hash, and makes new hashes with scrypt', async () => {
    expect(await hasher.verify('wrong', oldBcrypt.hash)).toBe(false);
    expect(await hasher.hash('pw')).toMatch(/^scrypt\$/u);
  });

  it('refuses a damaged bcrypt hash instead of throwing', async () => {
    expect(await hasher.verify('old password', '$2b$04$broken')).toBe(false);
  });
});

describe('Sha256TokenHasher', () => {
  it('produces a hex SHA-256 digest', async () => {
    expect(await new Sha256TokenHasher().hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
