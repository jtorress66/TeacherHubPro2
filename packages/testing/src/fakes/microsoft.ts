import { err, ok, type Result } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftError,
  MicrosoftGrantScope,
  OneDriveFile,
  OneDriveFiles,
  TeamsAssignmentRequest,
  TeamsAssignments,
  TeamsClass,
  TeamsClasses,
  TeamsStudent,
} from '@thp/ports';

/**
 * Microsoft's sign-in, as Microsoft behaves: a code works only with its PKCE verifier, a refresh
 * may or may not come with a new refresh token (`rotates`), and Teams is granted only to school
 * accounts (`schoolAccount`) and only while it stays allowed.
 */
export class FakeMicrosoftAuthorization implements MicrosoftAuthorization {
  static readonly code = 'microsoft-code';
  static readonly verifier = 'microsoft-verifier';
  static readonly accessToken = 'microsoft-access';
  /** The access token when Teams is granted too: it works for OneDrive and Teams. */
  static readonly teamsAccessToken = 'microsoft-teams-access';
  /** Whether a refresh issues a new refresh token (Microsoft may or may not). */
  rotates = true;
  /** A school (work) account can grant Teams; a personal account cannot. */
  schoolAccount = true;
  /** Makes the next refresh fail with this reason. */
  failWith: MicrosoftError['code'] | null = null;
  /** What the next refusal (an error sent back instead of a code) means. */
  refusalCode: MicrosoftError['code'] = 'declined';
  /** The refusals read so far, as Microsoft sent them. */
  readonly refusals: { readonly error: string; readonly description: string | null }[] = [];
  private issued = 0;
  /** Each live refresh token, and whether it carries Teams. */
  private readonly live = new Map<string, boolean>();

  authorizationUrl(
    input: {
      readonly state: string;
      readonly codeChallenge: string;
      readonly redirectUri: string;
    } & MicrosoftGrantScope,
  ): string {
    const url = new URL('https://login.microsoft.test/common/oauth2/v2.0/authorize');
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('teams', input.teams ? 'yes' : 'no');
    return url.toString();
  }

  private next(teams: boolean): string {
    this.issued += 1;
    const token = `microsoft-refresh-${String(this.issued)}`;
    this.live.set(token, teams);
    return token;
  }

  exchangeCode(
    input: { readonly code: string; readonly codeVerifier: string } & MicrosoftGrantScope,
  ): Promise<Result<{ readonly refreshToken: string; readonly teams: boolean }, MicrosoftError>> {
    const valid =
      input.code === FakeMicrosoftAuthorization.code &&
      input.codeVerifier === FakeMicrosoftAuthorization.verifier;
    if (!valid) return Promise.resolve(err({ code: 'unauthorized' }));
    const teams = input.teams && this.schoolAccount;
    return Promise.resolve(ok({ refreshToken: this.next(teams), teams }));
  }

  refresh(
    refreshToken: string,
    scope: MicrosoftGrantScope,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  > {
    if (this.failWith !== null) {
      const code = this.failWith;
      this.failWith = null;
      return Promise.resolve(err({ code }));
    }
    const teams = this.live.get(refreshToken);
    if (teams === undefined) return Promise.resolve(err({ code: 'unauthorized' }));
    if (scope.teams && !teams) return Promise.resolve(err({ code: 'insufficient_scope' }));
    if (this.rotates) this.live.delete(refreshToken);
    return Promise.resolve(
      ok({
        accessToken: scope.teams
          ? FakeMicrosoftAuthorization.teamsAccessToken
          : FakeMicrosoftAuthorization.accessToken,
        refreshToken: this.rotates ? this.next(teams) : refreshToken,
      }),
    );
  }

  refusal(response: {
    readonly error: string;
    readonly description: string | null;
  }): MicrosoftError {
    this.refusals.push(response);
    return { code: this.refusalCode };
  }

  /** As when the teacher removes the app from their Microsoft account: every token stops. */
  removeApp(): void {
    this.live.clear();
  }

  /** As when the school withdraws Teams: tokens keep OneDrive but lose Teams. */
  withdrawTeams(): void {
    for (const token of this.live.keys()) this.live.set(token, false);
  }
}

const accepted = new Set<string>([
  FakeMicrosoftAuthorization.accessToken,
  FakeMicrosoftAuthorization.teamsAccessToken,
]);

/** OneDrive uploads, recorded; `failWith` makes the next upload fail. */
export class FakeOneDriveFiles implements OneDriveFiles {
  readonly uploads: OneDriveFile[] = [];
  failWith: MicrosoftError['code'] | null = null;

  upload(
    accessToken: string,
    file: OneDriveFile,
  ): Promise<Result<{ readonly webUrl: string }, MicrosoftError>> {
    if (this.failWith !== null) {
      const code = this.failWith;
      this.failWith = null;
      return Promise.resolve(err({ code }));
    }
    if (!accepted.has(accessToken)) return Promise.resolve(err({ code: 'unauthorized' }));
    this.uploads.push(file);
    return Promise.resolve(
      ok({ webUrl: `https://onedrive.test/TeacherHubPro/${encodeURIComponent(file.name)}` }),
    );
  }
}

export interface FakeTeamsSetup {
  readonly teamsClass: TeamsClass;
  readonly students: readonly TeamsStudent[];
}

/**
 * Teams Assignments and rosters for one class: only a token that carries Teams works; a
 * OneDrive-only token is refused as `insufficient_scope`. `failWith` makes the next call fail.
 */
export class FakeTeams implements TeamsClasses, TeamsAssignments {
  readonly assignments: { readonly classId: string; readonly request: TeamsAssignmentRequest }[] =
    [];
  failWith: MicrosoftError['code'] | null = null;

  constructor(private readonly setup: FakeTeamsSetup) {}

  private access(accessToken: string, classId?: string): Result<true, MicrosoftError> {
    if (this.failWith !== null) {
      const code = this.failWith;
      this.failWith = null;
      return err({ code });
    }
    if (accessToken === FakeMicrosoftAuthorization.accessToken) {
      return err({ code: 'insufficient_scope' });
    }
    if (accessToken !== FakeMicrosoftAuthorization.teamsAccessToken) {
      return err({ code: 'unauthorized' });
    }
    if (classId !== undefined && classId !== this.setup.teamsClass.id) {
      return err({ code: 'not_found' });
    }
    return ok(true);
  }

  listClasses(accessToken: string): Promise<Result<readonly TeamsClass[], MicrosoftError>> {
    const access = this.access(accessToken);
    return Promise.resolve(access.ok ? ok([this.setup.teamsClass]) : access);
  }

  listStudents(
    accessToken: string,
    classId: string,
  ): Promise<Result<readonly TeamsStudent[], MicrosoftError>> {
    const access = this.access(accessToken, classId);
    return Promise.resolve(access.ok ? ok(this.setup.students) : access);
  }

  createAssignment(
    accessToken: string,
    classId: string,
    request: TeamsAssignmentRequest,
  ): Promise<Result<{ readonly id: string; readonly url: string }, MicrosoftError>> {
    const access = this.access(accessToken, classId);
    if (!access.ok) return Promise.resolve(access);
    this.assignments.push({ classId, request });
    const id = `teams-assignment-${String(this.assignments.length)}`;
    return Promise.resolve(ok({ id, url: `https://teams.test/class/${classId}/assignment/${id}` }));
  }
}
