import { describe, expect, it } from 'vitest';
import {
  microsoftAuthorizationContract,
  microsoftConnectionRepositoryContract,
  oneDriveFilesContract,
  teamsContract,
} from '../contracts/microsoft.contract.ts';
import { FakeMicrosoftAuthorization, FakeOneDriveFiles, FakeTeams } from './microsoft.ts';
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
oneDriveFilesContract('FakeOneDriveFiles (token with Teams)', () => ({
  files: new FakeOneDriveFiles(),
  accessToken: FakeMicrosoftAuthorization.teamsAccessToken,
}));

const students = [
  { firstName: 'Sofía', lastName: 'Torres' },
  { firstName: 'Diego', lastName: 'Vega' },
];
teamsContract('FakeTeams', () => ({
  teams: new FakeTeams({ teamsClass: { id: 'class-1', name: 'Science 5A' }, students }),
  accessToken: FakeMicrosoftAuthorization.teamsAccessToken,
  oneDriveOnlyToken: FakeMicrosoftAuthorization.accessToken,
  classId: 'class-1',
  className: 'Science 5A',
  students,
}));

const exchange = (auth: FakeMicrosoftAuthorization, teams: boolean) =>
  auth.exchangeCode({
    code: FakeMicrosoftAuthorization.code,
    codeVerifier: FakeMicrosoftAuthorization.verifier,
    teams,
  });

describe('FakeMicrosoftAuthorization', () => {
  it('stops every token once the teacher removes the app, and can be made busy', async () => {
    const auth = new FakeMicrosoftAuthorization();
    const granted = await exchange(auth, false);
    if (!granted.ok) throw new Error('exchange failed');
    auth.failWith = 'throttled';
    expect(await auth.refresh(granted.value.refreshToken, { teams: false })).toEqual({
      ok: false,
      error: { code: 'throttled' },
    });
    auth.removeApp();
    expect(await auth.refresh(granted.value.refreshToken, { teams: false })).toEqual({
      ok: false,
      error: { code: 'unauthorized' },
    });
  });

  it('never grants Teams to a personal account', async () => {
    const auth = new FakeMicrosoftAuthorization();
    auth.schoolAccount = false;
    const granted = await exchange(auth, true);
    expect(granted.ok && granted.value.teams).toBe(false);
  });

  it('keeps OneDrive but loses Teams when the school withdraws it', async () => {
    const auth = new FakeMicrosoftAuthorization();
    auth.rotates = false;
    const granted = await exchange(auth, true);
    if (!granted.ok) throw new Error('exchange failed');
    auth.withdrawTeams();
    expect(await auth.refresh(granted.value.refreshToken, { teams: true })).toEqual({
      ok: false,
      error: { code: 'insufficient_scope' },
    });
    expect((await auth.refresh(granted.value.refreshToken, { teams: false })).ok).toBe(true);
  });

  it('reads a refusal as the reason it was told to, and records it', () => {
    const auth = new FakeMicrosoftAuthorization();
    auth.refusalCode = 'admin_approval_required';
    expect(auth.refusal({ error: 'access_denied', description: 'AADSTS90094' })).toEqual({
      code: 'admin_approval_required',
    });
    expect(auth.refusals).toEqual([{ error: 'access_denied', description: 'AADSTS90094' }]);
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

describe('FakeTeams', () => {
  it('fails once with the chosen reason, and records what was posted', async () => {
    const teams = new FakeTeams({ teamsClass: { id: 'c', name: 'C' }, students });
    teams.failWith = 'throttled';
    const token = FakeMicrosoftAuthorization.teamsAccessToken;
    expect(await teams.listClasses(token)).toEqual({ ok: false, error: { code: 'throttled' } });
    const request = {
      title: 'T',
      instructions: '',
      resource: { kind: 'link', name: 'TeacherHubPro', url: 'https://app.test' },
      dueAt: null,
      assignAt: null,
    } as const;
    expect((await teams.createAssignment(token, 'c', request)).ok).toBe(true);
    expect(teams.assignments).toEqual([{ classId: 'c', request }]);
  });
});
