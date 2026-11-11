import { describe, expect, it } from 'vitest';
import { codeChallenge } from './pkce.ts';

describe('PKCE', () => {
  it('derives the S256 challenge from the verifier (RFC 7636, appendix B)', () => {
    expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});
