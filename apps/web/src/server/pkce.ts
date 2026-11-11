import { createHash } from 'node:crypto';

/** The PKCE S256 challenge: the verifier's SHA-256, base64url encoded without padding. */
export const codeChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url');
