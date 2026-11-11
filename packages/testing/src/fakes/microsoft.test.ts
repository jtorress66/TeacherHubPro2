import { describe, expect, it } from 'vitest';
import {
  microsoftAuthorizationContract,
  microsoftConnectionRepositoryContract,
  oneDriveFilesContract,
} from '../contracts/microsoft.contract.ts';
import { FakeMicrosoftAuthorization, FakeOneDriveFiles } from './microsoft.ts';
import { InMemoryMicrosoftConnectionRepository } from './repositories.ts';

microsoftConnectionRepositoryContract(
  'InMemoryMicrosoftConnectionRepository',
  () => new InMemoryMicrosoftConnectionRepository(),
);
for (const rotates of [true, false]) {
  microsoftAuthorizationContract(
    `FakeMicrosoftAuthorization (${rotates ? 'new' : 'same'} refresh token)`,
    () => {
      const auth = new FakeMicrosoftAuthorization();
      auth.rotates = rotates;
      return {
        auth,
        code: FakeMicrosoftAuthorization.code,
        codeVerifier: FakeMicrosoftAuthorization.verifier,
      };
    },
  );
}
oneDriveFilesContract('FakeOneDriveFiles', () => ({
  files: new FakeOneDriveFiles(),
  accessToken: FakeMicrosoftAuthorization.accessToken,
}));

describe('FakeMicrosoftAuthorization', () => {
  it('stops every token once the teacher removes the app, and can be made busy', async () => {
    const auth = new FakeMicrosoftAuthorization();
    const granted = await auth.exchangeCode({
      code: FakeMicrosoftAuthorization.code,
      codeVerifier: FakeMicrosoftAuthorization.verifier,
    });
    if (!granted.ok) throw new Error('exchange failed');
    auth.failWith = 'throttled';
    expect(await auth.refresh(granted.value.refreshToken)).toEqual({
      ok: false,
      error: { code: 'throttled' },
    });
    auth.removeApp();
    expect(await auth.refresh(granted.value.refreshToken)).toEqual({
      ok: false,
      error: { code: 'unauthorized' },
    });
  });
});

describe('FakeOneDriveFiles', () => {
  it('fails once with the chosen reason', async () => {
    const files = new FakeOneDriveFiles();
    files.failWith = 'unavailable';
    const file = { name: 'a.docx', mimeType: 'x', bytes: new Uint8Array() };
    const token = FakeMicrosoftAuthorization.accessToken;
    expect(await files.upload(token, file)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
    expect((await files.upload(token, file)).ok).toBe(true);
  });
});
