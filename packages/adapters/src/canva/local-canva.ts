import { createHash } from 'node:crypto';
import { err, ok, type Result } from '@thp/domain';
import type { CanvaAuthorization, CanvaDesigns, CanvaError } from '@thp/ports';

// Stand-ins for Canva in local runs and E2E tests: no Canva account, no network.

const codePrefix = 'local-canva-code.';
const refreshPrefix = 'local-canva-refresh-';

export const localCanvaFixture = { accessToken: 'local-canva-access' } as const;

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Grants access at once: the address goes straight back to the app, the challenge in the code. */
export class LocalCanvaAuthorization implements CanvaAuthorization {
  private issued = 0;
  private readonly revoked = new Set<string>();

  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    const url = new URL(input.redirectUri);
    url.searchParams.set('code', `${codePrefix}${input.codeChallenge}`);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('redirect_uri', input.redirectUri);
    return url.toString();
  }

  private next(): string {
    this.issued += 1;
    return `${refreshPrefix}${String(this.issued)}`;
  }

  exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
  }): Promise<Result<{ readonly refreshToken: string }, CanvaError>> {
    const valid = input.code === `${codePrefix}${challengeOf(input.codeVerifier)}`;
    return Promise.resolve(
      valid ? ok({ refreshToken: this.next() }) : err({ code: 'unauthorized' }),
    );
  }

  refresh(
    refreshToken: string,
  ): Promise<Result<{ readonly accessToken: string; readonly refreshToken: string }, CanvaError>> {
    return Promise.resolve(
      refreshToken.startsWith(refreshPrefix) && !this.revoked.has(refreshToken)
        ? ok({ accessToken: localCanvaFixture.accessToken, refreshToken: this.next() })
        : err({ code: 'unauthorized' }),
    );
  }

  revoke(refreshToken: string): Promise<Result<true, CanvaError>> {
    this.revoked.add(refreshToken);
    return Promise.resolve(ok(true));
  }
}

/** A stand-in for Canva's imports: designs are only counted. */
export class LocalCanvaDesigns implements CanvaDesigns {
  private made = 0;

  importFile(accessToken: string): Promise<Result<{ readonly editUrl: string }, CanvaError>> {
    if (accessToken !== localCanvaFixture.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.made += 1;
    return Promise.resolve(
      ok({ editUrl: `https://canva.local/design/LOCAL${String(this.made)}/edit` }),
    );
  }
}
