import { createHash } from 'node:crypto';
import { err, ok, type Result } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftError,
  MicrosoftGrantScope,
  OneDriveFiles,
  TeamsAssignments,
  TeamsClass,
  TeamsClasses,
  TeamsStudent,
} from '@thp/ports';
import { microsoftRefusal } from './microsoft-refusal.ts';

// Stand-ins for Microsoft in local runs and E2E tests: no Microsoft account, no network. The
// stand-in account is a school account, so Teams is granted when asked for.

const codePrefix = 'local-microsoft-code.';
const teamsCodePrefix = 'local-microsoft-teams-code.';
const refreshPrefix = 'local-microsoft-refresh-';
const teamsRefreshPrefix = 'local-microsoft-refresh-teams-';

export const localMicrosoftFixture = {
  accessToken: 'local-microsoft-access',
  /** The access token when Teams is granted too: it works for OneDrive and Teams. */
  teamsAccessToken: 'local-microsoft-teams-access',
  teamsClass: { id: 'local-teams-class', name: 'Local Teams class' },
  students: [
    { firstName: 'Sofía', lastName: 'Torres' },
    { firstName: 'Diego', lastName: 'Vega' },
  ],
} as const satisfies {
  accessToken: string;
  teamsAccessToken: string;
  teamsClass: TeamsClass;
  students: readonly TeamsStudent[];
};

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Grants access at once: the address goes straight back to the app, the challenge in the code. */
export class LocalMicrosoftAuthorization implements MicrosoftAuthorization {
  private issued = 0;

  authorizationUrl(
    input: {
      readonly state: string;
      readonly codeChallenge: string;
      readonly redirectUri: string;
    } & MicrosoftGrantScope,
  ): string {
    const url = new URL(input.redirectUri);
    const prefix = input.teams ? teamsCodePrefix : codePrefix;
    url.searchParams.set('code', `${prefix}${input.codeChallenge}`);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('redirect_uri', input.redirectUri);
    return url.toString();
  }

  exchangeCode(
    input: { readonly code: string; readonly codeVerifier: string } & MicrosoftGrantScope,
  ): Promise<Result<{ readonly refreshToken: string; readonly teams: boolean }, MicrosoftError>> {
    const challenge = challengeOf(input.codeVerifier);
    const valid =
      input.code === `${codePrefix}${challenge}` || input.code === `${teamsCodePrefix}${challenge}`;
    if (!valid) return Promise.resolve(err({ code: 'unauthorized' }));
    this.issued += 1;
    const prefix = input.teams ? teamsRefreshPrefix : refreshPrefix;
    return Promise.resolve(
      ok({ refreshToken: `${prefix}${String(this.issued)}`, teams: input.teams }),
    );
  }

  /** Keeps the same refresh token, as Microsoft sometimes does. */
  refresh(
    refreshToken: string,
    scope: MicrosoftGrantScope,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  > {
    if (!refreshToken.startsWith(refreshPrefix)) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    if (scope.teams && !refreshToken.startsWith(teamsRefreshPrefix)) {
      return Promise.resolve(err({ code: 'insufficient_scope' }));
    }
    const accessToken = scope.teams
      ? localMicrosoftFixture.teamsAccessToken
      : localMicrosoftFixture.accessToken;
    return Promise.resolve(ok({ accessToken, refreshToken }));
  }

  refusal(response: {
    readonly error: string;
    readonly description: string | null;
  }): MicrosoftError {
    return microsoftRefusal(response);
  }
}

const accessTokens = new Set<string>([
  localMicrosoftFixture.accessToken,
  localMicrosoftFixture.teamsAccessToken,
]);

/** A stand-in for OneDrive: files are not kept, only given a link. */
export class LocalOneDriveFiles implements OneDriveFiles {
  upload(
    accessToken: string,
    file: { readonly name: string },
  ): Promise<Result<{ readonly webUrl: string }, MicrosoftError>> {
    if (!accessTokens.has(accessToken)) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    return Promise.resolve(
      ok({ webUrl: `https://onedrive.local/TeacherHubPro/${encodeURIComponent(file.name)}` }),
    );
  }
}

/** A stand-in for Teams: one class with two students; assignments are only given a link. */
export class LocalTeams implements TeamsClasses, TeamsAssignments {
  private posted = 0;

  private check(accessToken: string, classId?: string): Result<true, MicrosoftError> {
    if (accessToken === localMicrosoftFixture.accessToken) {
      return err({ code: 'insufficient_scope' });
    }
    if (accessToken !== localMicrosoftFixture.teamsAccessToken) {
      return err({ code: 'unauthorized' });
    }
    if (classId !== undefined && classId !== localMicrosoftFixture.teamsClass.id) {
      return err({ code: 'not_found' });
    }
    return ok(true);
  }

  listClasses(accessToken: string): Promise<Result<readonly TeamsClass[], MicrosoftError>> {
    const access = this.check(accessToken);
    return Promise.resolve(access.ok ? ok([localMicrosoftFixture.teamsClass]) : access);
  }

  listStudents(
    accessToken: string,
    classId: string,
  ): Promise<Result<readonly TeamsStudent[], MicrosoftError>> {
    const access = this.check(accessToken, classId);
    return Promise.resolve(access.ok ? ok(localMicrosoftFixture.students) : access);
  }

  createAssignment(
    accessToken: string,
    classId: string,
  ): Promise<Result<{ readonly id: string; readonly url: string }, MicrosoftError>> {
    const access = this.check(accessToken, classId);
    if (!access.ok) return Promise.resolve(access);
    this.posted += 1;
    const id = `local-teams-assignment-${String(this.posted)}`;
    return Promise.resolve(
      ok({ id, url: `https://teams.local/class/${classId}/assignment/${id}` }),
    );
  }
}
