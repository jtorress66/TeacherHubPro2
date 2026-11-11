import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import type { CanvaAuthorization, CanvaConnectionRepository, CanvaDesigns } from '@thp/ports';
import { aCanvaConnection } from '../fixtures.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export function canvaConnectionRepositoryContract(
  name: string,
  make: () => CanvaConnectionRepository,
): void {
  describe(`${name} (CanvaConnectionRepository)`, () => {
    it('keeps one connection per teacher, within the school', async () => {
      const repo = make();
      const connection = aCanvaConnection({ schoolId: schoolA });
      await repo.save(connection);
      await repo.save({ ...connection, encryptedRefreshToken: 'sealed-2' });
      expect(await repo.find(schoolA, connection.teacherId)).toEqual({
        ...connection,
        encryptedRefreshToken: 'sealed-2',
      });
      expect(await repo.find(schoolB, connection.teacherId)).toBeNull();
    });

    it('deletes a connection only within its school', async () => {
      const repo = make();
      const connection = aCanvaConnection({ schoolId: schoolA });
      await repo.save(connection);
      await repo.delete(schoolB, connection.teacherId);
      expect(await repo.find(schoolA, connection.teacherId)).not.toBeNull();
      await repo.delete(schoolA, connection.teacherId);
      expect(await repo.find(schoolA, 'nobody' as UserId)).toBeNull();
      expect(await repo.find(schoolA, connection.teacherId)).toBeNull();
    });
  });
}

export interface CanvaAuthorizationSetup {
  readonly auth: CanvaAuthorization;
  /** A code and PKCE verifier this sign-in accepts. */
  readonly code: string;
  readonly codeVerifier: string;
}

export function canvaAuthorizationContract(
  name: string,
  make: () => CanvaAuthorizationSetup,
): void {
  describe(`${name} (CanvaAuthorization contract)`, () => {
    const redirectUri = 'https://app.test/api/canva/callback';

    it('builds a consent address that carries the state, the PKCE challenge and the return address', () => {
      const url = new URL(
        make().auth.authorizationUrl({
          state: 'state-1',
          codeChallenge: 'challenge-1',
          redirectUri,
        }),
      );
      expect(url.searchParams.get('state')).toBe('state-1');
      expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    });

    it('exchanges a code for a refresh token that is replaced at every use', async () => {
      const { auth, code, codeVerifier } = make();
      const granted = await auth.exchangeCode({ code, codeVerifier, redirectUri });
      if (!granted.ok) throw new Error('exchange failed');
      const first = await auth.refresh(granted.value.refreshToken);
      if (!first.ok) throw new Error('refresh failed');
      expect(first.value.accessToken).not.toBe('');
      expect(first.value.refreshToken).not.toBe(granted.value.refreshToken);
      expect((await auth.refresh(first.value.refreshToken)).ok).toBe(true);
    });

    it('revokes a refresh token, after which it no longer works', async () => {
      const { auth, code, codeVerifier } = make();
      const granted = await auth.exchangeCode({ code, codeVerifier, redirectUri });
      if (!granted.ok) throw new Error('exchange failed');
      await auth.revoke(granted.value.refreshToken);
      expect(await auth.refresh(granted.value.refreshToken)).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });

    it('refuses a code with the wrong verifier', async () => {
      const { auth, code } = make();
      expect(await auth.exchangeCode({ code, codeVerifier: 'wrong', redirectUri })).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });
  });
}

export interface CanvaDesignsSetup {
  readonly designs: CanvaDesigns;
  readonly accessToken: string;
}

export function canvaDesignsContract(name: string, make: () => CanvaDesignsSetup): void {
  describe(`${name} (CanvaDesigns contract)`, () => {
    const file = {
      title: 'Volcanoes',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      bytes: new Uint8Array([0x50, 0x4b, 3, 4]),
    };

    it('imports a file and returns a link to edit the design', async () => {
      const { designs, accessToken } = make();
      const imported = await designs.importFile(accessToken, file);
      if (!imported.ok) throw new Error(imported.error.code);
      expect(new URL(imported.value.editUrl).protocol).toBe('https:');
    });

    it('refuses an expired or revoked access token', async () => {
      expect(await make().designs.importFile('not-a-token', file)).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });
  });
}
