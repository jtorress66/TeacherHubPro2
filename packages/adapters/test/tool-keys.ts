import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import type { PublicJwk, ToolJwtSigner, ToolKeyStore } from '@thp/ports';

/** A real RSA tool key, as the tool key store keeps it, for the pretend course system to check. */
export class TestToolKeys implements ToolKeyStore, ToolJwtSigner {
  private keys: Promise<{ privateKey: CryptoKey; jwk: PublicJwk }> | undefined;

  constructor(private readonly kid = 'tool-key-1') {}

  async publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }> {
    return { keys: [(await this.pair()).jwk] };
  }

  async sign(claims: Readonly<Record<string, unknown>>): Promise<string> {
    const { privateKey } = await this.pair();
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .sign(privateKey);
  }

  private pair() {
    this.keys ??= (async () => {
      const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
      const { kty = 'RSA', n = '', e = '' } = await exportJWK(publicKey);
      return { privateKey, jwk: { kty, n, e, kid: this.kid, alg: 'RS256', use: 'sig' } };
    })();
    return this.keys;
  }
}
