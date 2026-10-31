import { describe, expect, it } from 'vitest';
import type { PasswordHasher, RandomTokenGenerator, SecretCipher, TokenHasher } from '@thp/ports';

export function randomTokenGeneratorContract(name: string, make: () => RandomTokenGenerator): void {
  describe(`${name} (RandomTokenGenerator contract)`, () => {
    it('returns URL-safe tokens of at least 32 characters', () => {
      const token = make().generate();

      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('returns unique tokens', () => {
      const generator = make();
      const tokens = Array.from({ length: 500 }, () => generator.generate());

      expect(new Set(tokens).size).toBe(tokens.length);
    });
  });
}

export function tokenHasherContract(name: string, make: () => TokenHasher): void {
  describe(`${name} (TokenHasher contract)`, () => {
    it('is deterministic, so a presented token can be looked up by its hash', async () => {
      const hasher = make();

      expect(await hasher.hash('abc')).toBe(await hasher.hash('abc'));
    });

    it('never stores the token itself and separates different tokens', async () => {
      const hasher = make();
      const hash = await hasher.hash('secret-token');

      expect(hash).not.toContain('secret-token');
      expect(await hasher.hash('other-token')).not.toBe(hash);
    });
  });
}

export function passwordHasherContract(
  name: string,
  make: () => PasswordHasher,
  legacyHash?: { readonly password: string; readonly hash: string },
): void {
  describe(`${name} (PasswordHasher contract)`, () => {
    it('verifies the right password and rejects a wrong one', async () => {
      const hasher = make();
      const hash = await hasher.hash('correct horse');

      expect(await hasher.verify('correct horse', hash)).toBe(true);
      expect(await hasher.verify('wrong horse', hash)).toBe(false);
    });

    it('the same password never gives the same hash, and the hash hides it', async () => {
      const hasher = make();
      const [first, second] = [await hasher.hash('pw'), await hasher.hash('pw')];

      expect(first).not.toBe(second);
      expect(first).not.toContain('correct horse');
    });

    it('does not ask to rehash its own hashes', async () => {
      const hasher = make();

      expect(hasher.needsRehash(await hasher.hash('pw'))).toBe(false);
    });

    if (legacyHash !== undefined) {
      it('accepts an older hash and asks to rehash it', async () => {
        const hasher = make();

        expect(await hasher.verify(legacyHash.password, legacyHash.hash)).toBe(true);
        expect(hasher.needsRehash(legacyHash.hash)).toBe(true);
      });
    }
  });
}

export function secretCipherContract(name: string, make: () => SecretCipher): void {
  describe(`${name} (SecretCipher contract)`, () => {
    it('gives back the secret it sealed, without showing it', async () => {
      const cipher = make();
      const sealed = await cipher.encrypt('refresh-token-123');
      expect(sealed).not.toContain('refresh-token-123');
      expect(await cipher.decrypt(sealed)).toEqual({ ok: true, value: 'refresh-token-123' });
    });

    it('seals the same secret differently each time', async () => {
      const cipher = make();
      expect(await cipher.encrypt('same')).not.toBe(await cipher.encrypt('same'));
    });

    it('refuses something it did not seal, or that was changed', async () => {
      const cipher = make();
      const sealed = await cipher.encrypt('secret');
      expect(await cipher.decrypt('not sealed')).toEqual({ ok: false, error: { code: 'invalid' } });
      const last = sealed.slice(-1);
      const tampered = `${sealed.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
      expect(await cipher.decrypt(tampered)).toEqual({ ok: false, error: { code: 'invalid' } });
    });
  });
}
