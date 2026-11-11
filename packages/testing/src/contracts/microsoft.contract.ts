import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftConnectionRepository,
  OneDriveFiles,
} from '@thp/ports';
import { aMicrosoftConnection } from '../fixtures.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export function microsoftConnectionRepositoryContract(
  name: string,
  make: () => MicrosoftConnectionRepository,
): void {
  describe(`${name} (MicrosoftConnectionRepository)`, () => {
    it('keeps one connection per teacher, within the school', async () => {
      const repo = make();
      const connection = aMicrosoftConnection({ schoolId: schoolA });
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
      const connection = aMicrosoftConnection({ schoolId: schoolA });
      await repo.save(connection);
      await repo.delete(schoolB, connection.teacherId);
      expect(await repo.find(schoolA, connection.teacherId)).not.toBeNull();
      await repo.delete(schoolA, connection.teacherId);
      expect(await repo.find(schoolA, 'nobody' as UserId)).toBeNull();
      expect(await repo.find(schoolA, connection.teacherId)).toBeNull();
    });
  });
}

export interface MicrosoftAuthorizationSetup {
  readonly auth: MicrosoftAuthorization;
  /** A code and PKCE verifier this sign-in accepts. */
  readonly code: string;
  readonly codeVerifier: string;
}

export function microsoftAuthorizationContract(
  name: string,
  make: () => MicrosoftAuthorizationSetup,
): void {
  describe(`${name} (MicrosoftAuthorization contract)`, () => {
    const redirectUri = 'https://app.test/api/microsoft/callback';

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

    it('exchanges a code for a refresh token that keeps giving access tokens', async () => {
      const { auth, code, codeVerifier } = make();
      const granted = await auth.exchangeCode({ code, codeVerifier, redirectUri });
      if (!granted.ok) throw new Error('exchange failed');
      const first = await auth.refresh(granted.value.refreshToken);
      if (!first.ok) throw new Error('refresh failed');
      expect(first.value.accessToken).not.toBe('');
      expect(first.value.refreshToken).not.toBe('');
      expect((await auth.refresh(first.value.refreshToken)).ok).toBe(true);
    });

    it('refuses a refresh token it never issued', async () => {
      expect(await make().auth.refresh('not-a-token')).toEqual({
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

export interface OneDriveFilesSetup {
  readonly files: OneDriveFiles;
  readonly accessToken: string;
}

export function oneDriveFilesContract(name: string, make: () => OneDriveFilesSetup): void {
  describe(`${name} (OneDriveFiles contract)`, () => {
    const file = {
      name: 'Volcanoes.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      bytes: new Uint8Array([0x50, 0x4b, 3, 4]),
    };

    it('saves a file and returns a link to open it in OneDrive', async () => {
      const { files, accessToken } = make();
      const saved = await files.upload(accessToken, file);
      if (!saved.ok) throw new Error(saved.error.code);
      expect(new URL(saved.value.webUrl).protocol).toBe('https:');
    });

    it('refuses an expired or revoked access token', async () => {
      expect(await make().files.upload('not-a-token', file)).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });
  });
}
