import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { err, ok, type Result } from '@thp/domain';
import type { SecretCipher, SecretCipherError } from '@thp/ports';

const version = 'v1';

/**
 * AES-256-GCM for secrets kept at rest (OAuth refresh tokens). Each seal has a fresh 12-byte nonce
 * and an authentication tag, so a changed or foreign value is refused. The key comes from
 * TOKEN_ENCRYPTION_KEY (32 random bytes, base64) and is never logged.
 */
export class AesGcmCipher implements SecretCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.');
    }
    this.key = key;
  }

  encrypt(plain: string): Promise<string> {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const parts = [nonce, cipher.getAuthTag(), body].map((part) => part.toString('base64url'));
    return Promise.resolve([version, ...parts].join('.'));
  }

  decrypt(sealed: string): Promise<Result<string, SecretCipherError>> {
    const [tag, nonce, auth, body] = sealed.split('.');
    if (tag !== version || nonce === undefined || auth === undefined || body === undefined) {
      return Promise.resolve(err({ code: 'invalid' }));
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(nonce, 'base64url'));
      decipher.setAuthTag(Buffer.from(auth, 'base64url'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
      ]);
      return Promise.resolve(ok(plain.toString('utf8')));
    } catch {
      return Promise.resolve(err({ code: 'invalid' }));
    }
  }
}
