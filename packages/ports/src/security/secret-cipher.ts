import type { Result } from '@thp/domain';

export interface SecretCipherError {
  readonly code: 'invalid';
}

/** Encrypts secrets kept at rest (such as OAuth refresh tokens); never logs them. */
export interface SecretCipher {
  encrypt(plain: string): Promise<string>;
  decrypt(sealed: string): Promise<Result<string, SecretCipherError>>;
}
