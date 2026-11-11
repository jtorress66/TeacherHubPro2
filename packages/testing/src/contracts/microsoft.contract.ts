import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftConnectionRepository,
  OneDriveFiles,
  TeamsAssignmentRequest,
  TeamsAssignments,
  TeamsClasses,
  TeamsStudent,
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

    it('remembers whether the teacher allowed Teams', async () => {
      const repo = make();
      const connection = aMicrosoftConnection({ schoolId: schoolA, teams: true });
      await repo.save(connection);
      expect(await repo.find(schoolA, connection.teacherId)).toEqual(connection);
      await repo.save({ ...connection, teams: false });
      expect((await repo.find(schoolA, connection.teacherId))?.teams).toBe(false);
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
  /** A code and PKCE verifier this sign-in accepts, from a school account. */
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
      for (const teams of [false, true]) {
        const url = new URL(
          make().auth.authorizationUrl({
            state: 'state-1',
            codeChallenge: 'challenge-1',
            redirectUri,
            teams,
          }),
        );
        expect(url.searchParams.get('state')).toBe('state-1');
        expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
        expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
      }
    });

    it('exchanges a code for a refresh token that keeps giving access tokens', async () => {
      const { auth, code, codeVerifier } = make();
      const granted = await auth.exchangeCode({ code, codeVerifier, redirectUri, teams: false });
      if (!granted.ok) throw new Error('exchange failed');
      expect(granted.value.teams).toBe(false);
      const first = await auth.refresh(granted.value.refreshToken, { teams: false });
      if (!first.ok) throw new Error('refresh failed');
      expect(first.value.accessToken).not.toBe('');
      expect(first.value.refreshToken).not.toBe('');
      expect((await auth.refresh(first.value.refreshToken, { teams: false })).ok).toBe(true);
    });

    it('grants Teams to a school account that allows it, and refreshes with Teams', async () => {
      const { auth, code, codeVerifier } = make();
      const granted = await auth.exchangeCode({ code, codeVerifier, redirectUri, teams: true });
      if (!granted.ok) throw new Error('exchange failed');
      expect(granted.value.teams).toBe(true);
      const withTeams = await auth.refresh(granted.value.refreshToken, { teams: true });
      if (!withTeams.ok) throw new Error('refresh failed');
      expect((await auth.refresh(withTeams.value.refreshToken, { teams: false })).ok).toBe(true);
    });

    it('refuses Teams on a grant that never included it', async () => {
      const { auth, code, codeVerifier } = make();
      const granted = await auth.exchangeCode({ code, codeVerifier, redirectUri, teams: false });
      if (!granted.ok) throw new Error('exchange failed');
      expect(await auth.refresh(granted.value.refreshToken, { teams: true })).toEqual({
        ok: false,
        error: { code: 'insufficient_scope' },
      });
    });

    it('refuses a refresh token it never issued', async () => {
      expect(await make().auth.refresh('not-a-token', { teams: false })).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });

    it('refuses a code with the wrong verifier', async () => {
      const { auth, code } = make();
      expect(
        await auth.exchangeCode({ code, codeVerifier: 'wrong', redirectUri, teams: false }),
      ).toEqual({ ok: false, error: { code: 'unauthorized' } });
    });

    it('reads a refusal as one of the consent reasons', () => {
      const { code } = make().auth.refusal({ error: 'access_denied', description: null });
      expect(['admin_approval_required', 'school_account_required', 'declined']).toContain(code);
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

export interface TeamsSetup {
  readonly teams: TeamsClasses & TeamsAssignments;
  /** A token that carries Teams. */
  readonly accessToken: string;
  /** A token from a grant without Teams (OneDrive only). */
  readonly oneDriveOnlyToken: string;
  readonly classId: string;
  readonly className: string;
  readonly students: readonly TeamsStudent[];
}

const assignment = (resource: TeamsAssignmentRequest['resource']): TeamsAssignmentRequest => ({
  title: 'Unit 3 test',
  instructions: 'Answer every question.',
  resource,
  dueAt: new Date('2026-12-02T03:59:00Z'),
  assignAt: null,
});

const link = { kind: 'link', name: 'TeacherHubPro', url: 'https://app.test' } as const;

export function teamsContract(name: string, make: () => TeamsSetup): void {
  describe(`${name} (TeamsClasses and TeamsAssignments contract)`, () => {
    it("lists the teacher's Teams classes", async () => {
      const { teams, accessToken, classId, className } = make();
      expect(await teams.listClasses(accessToken)).toEqual({
        ok: true,
        value: [{ id: classId, name: className }],
      });
    });

    it("lists a class's students by first and last name only, without its teachers", async () => {
      const { teams, accessToken, classId, students } = make();
      const listed = await teams.listStudents(accessToken, classId);
      if (!listed.ok) throw new Error(listed.error.code);
      expect(listed.value).toEqual(students);
      for (const student of listed.value) {
        expect(Object.keys(student).sort()).toEqual(['firstName', 'lastName']);
      }
    });

    it('posts an assignment with a link, or a Word document each student gets a copy of', async () => {
      const { teams, accessToken, classId } = make();
      for (const resource of [
        link,
        { kind: 'wordCopy', fileName: 'unit-3.docx', bytes: new Uint8Array([0x50, 0x4b, 3, 4]) },
      ] as const) {
        const posted = await teams.createAssignment(accessToken, classId, assignment(resource));
        if (!posted.ok) throw new Error(posted.error.code);
        expect(posted.value.id).not.toBe('');
        expect(new URL(posted.value.url).protocol).toBe('https:');
      }
    });

    it("refuses a class that is not the teacher's", async () => {
      const { teams, accessToken } = make();
      expect(await teams.listStudents(accessToken, 'someone-else')).toEqual({
        ok: false,
        error: { code: 'not_found' },
      });
      expect(await teams.createAssignment(accessToken, 'someone-else', assignment(link))).toEqual({
        ok: false,
        error: { code: 'not_found' },
      });
    });

    it('refuses a token without Teams, and an expired one', async () => {
      const { teams, oneDriveOnlyToken, classId } = make();
      expect(await teams.listClasses(oneDriveOnlyToken)).toEqual({
        ok: false,
        error: { code: 'insufficient_scope' },
      });
      expect(await teams.createAssignment('expired', classId, assignment(link))).toEqual({
        ok: false,
        error: { code: 'unauthorized' },
      });
    });
  });
}
