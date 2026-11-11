import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { microsoftAuthorizationContract, oneDriveFilesContract, teamsContract } from '@thp/testing';
import {
  MicrosoftIdentityAuthorization,
  OneDriveGraphFiles,
} from '../src/microsoft/microsoft-graph.ts';
import {
  LocalMicrosoftAuthorization,
  LocalOneDriveFiles,
  LocalTeams,
  localMicrosoftFixture,
} from '../src/microsoft/local-microsoft.ts';
import { microsoftRefusal } from '../src/microsoft/microsoft-refusal.ts';

const client = { clientId: 'client-1', clientSecret: 'secret-1' };
const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const scope = 'openid offline_access User.Read Files.ReadWrite';
const teamsScope = `${scope} EduRoster.ReadBasic EduAssignments.ReadWrite Files.ReadWrite.All`;
const urlOf = (input: string | URL | Request) =>
  input instanceof Request ? input.url : input.toString();

/**
 * The Microsoft identity platform's token endpoint, as documented: a refresh may come back with
 * a new refresh token (`rotates`) or without one; the response's `scope` lists what the token is
 * for, with Graph permissions named by their full address. A personal account
 * (`schoolAccount: false`) never gets the Edu (Teams) permissions, and a refresh that asks for
 * permissions the grant lacks is refused with AADSTS65001.
 */
function tokenApi({ rotates = true, schoolAccount = true } = {}) {
  /** Each live refresh token, and whether it carries Teams. */
  const live = new Map<string, boolean>();
  let issued = 0;
  const calls: URLSearchParams[] = [];
  const asksTeams = (body: URLSearchParams) =>
    (body.get('scope') ?? '').includes('EduRoster.ReadBasic');
  const scopeOf = (teams: boolean) =>
    (teams ? teamsScope : scope)
      .split(' ')
      .filter((name) => !['openid', 'offline_access'].includes(name))
      .map((name) => `https://graph.microsoft.com/${name}`)
      .join(' ');
  const grant = (teams: boolean, refreshToken: string | null) => {
    issued += 1;
    return Response.json({
      token_type: 'Bearer',
      scope: scopeOf(teams),
      expires_in: 3599,
      access_token: `access-${String(issued)}`,
      ...(refreshToken === null ? {} : { refresh_token: refreshToken }),
    });
  };
  const next = (teams: boolean) => {
    const token = `refresh-${String(issued + 1)}`;
    live.set(token, teams);
    return grant(teams, token);
  };
  const invalidGrant = (codes: number[], text: string) =>
    Response.json(
      { error: 'invalid_grant', error_description: text, error_codes: codes },
      { status: 400 },
    );
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve();
    expect(urlOf(input)).toBe(tokenUrl);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    );
    const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    calls.push(body);
    if (body.get('client_id') !== 'client-1' || body.get('client_secret') !== 'secret-1') {
      return Response.json({ error: 'invalid_client' }, { status: 401 });
    }
    if (body.get('grant_type') === 'authorization_code') {
      return body.get('code') === 'code-1' && body.get('code_verifier') === 'verifier-1'
        ? next(asksTeams(body) && schoolAccount)
        : invalidGrant([70000], 'AADSTS70000: The provided grant is invalid.');
    }
    const used = body.get('refresh_token') ?? '';
    const teams = live.get(used);
    if (teams === undefined) return invalidGrant([70000], 'AADSTS70000: expired.');
    if (asksTeams(body) && !teams) {
      return invalidGrant(
        [65001],
        "AADSTS65001: The user or administrator has not consented to use the application with ID 'client-1'.",
      );
    }
    if (!rotates) return grant(asksTeams(body), null);
    live.delete(used);
    return next(teams);
  };
  return { fetchFn, calls };
}

const respond = (status: number, body: object) => async () => {
  await Promise.resolve();
  return Response.json(body, { status });
};

/** Microsoft Graph's simple upload: PUT the bytes, get the DriveItem back. */
function driveApi(accessToken: string) {
  const puts: { url: string; headers: Headers; body: unknown }[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve();
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${accessToken}`) {
      return Response.json(
        { error: { code: 'InvalidAuthenticationToken', message: 'expired' } },
        { status: 401 },
      );
    }
    expect(init?.method).toBe('PUT');
    puts.push({ url: urlOf(input), headers, body: init?.body });
    const name = decodeURIComponent(
      urlOf(input).split('/TeacherHubPro/')[1]?.split(':/content')[0] ?? '',
    );
    return Response.json(
      {
        id: '01ABC',
        name,
        size: 4,
        webUrl: `https://contoso-my.sharepoint.com/personal/ana/Documents/TeacherHubPro/${encodeURIComponent(name)}`,
        file: { mimeType: headers.get('content-type') },
      },
      { status: 201 },
    );
  };
  return { fetchFn, puts };
}

for (const rotates of [true, false]) {
  microsoftAuthorizationContract(
    `MicrosoftIdentityAuthorization (${rotates ? 'new' : 'same'} refresh token)`,
    () => ({
      auth: new MicrosoftIdentityAuthorization(client, tokenApi({ rotates }).fetchFn),
      code: 'code-1',
      codeVerifier: 'verifier-1',
    }),
  );
}
microsoftAuthorizationContract('LocalMicrosoftAuthorization', () => {
  const auth = new LocalMicrosoftAuthorization();
  const codeVerifier = 'local-verifier';
  const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const back = new URL(
    auth.authorizationUrl({
      state: 's',
      codeChallenge: challenge,
      redirectUri: 'https://a.test/cb',
      teams: false,
    }),
  );
  return { auth, code: back.searchParams.get('code') ?? '', codeVerifier };
});
oneDriveFilesContract('OneDriveGraphFiles', () => ({
  files: new OneDriveGraphFiles(driveApi('access-1').fetchFn),
  accessToken: 'access-1',
}));
for (const accessToken of [
  localMicrosoftFixture.accessToken,
  localMicrosoftFixture.teamsAccessToken,
]) {
  oneDriveFilesContract(`LocalOneDriveFiles (${accessToken})`, () => ({
    files: new LocalOneDriveFiles(),
    accessToken,
  }));
}
teamsContract('LocalTeams', () => ({
  teams: new LocalTeams(),
  accessToken: localMicrosoftFixture.teamsAccessToken,
  oneDriveOnlyToken: localMicrosoftFixture.accessToken,
  classId: localMicrosoftFixture.teamsClass.id,
  className: localMicrosoftFixture.teamsClass.name,
  students: localMicrosoftFixture.students,
}));

describe('MicrosoftIdentityAuthorization', () => {
  const consentUrl = (teams: boolean) =>
    new URL(
      new MicrosoftIdentityAuthorization(client).authorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        redirectUri: 'https://app.test/api/microsoft/callback',
        teams,
      }),
    );

  it('asks for OneDrive files and offline access, with the S256 PKCE method', () => {
    const url = consentUrl(false);
    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      response_type: 'code',
      redirect_uri: 'https://app.test/api/microsoft/callback',
      response_mode: 'query',
      scope,
      state: 'state-1',
      code_challenge: 'challenge-1',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  });

  it('adds the Teams permissions only when the teacher allows Teams, never forcing consent', () => {
    const url = consentUrl(true);
    expect(url.searchParams.get('scope')).toBe(teamsScope);
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('sends the code with its verifier, return address, scopes and the client credentials', async () => {
    const api = tokenApi();
    await new MicrosoftIdentityAuthorization(client, api.fetchFn).exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/api/microsoft/callback',
      teams: false,
    });
    expect(Object.fromEntries(api.calls[0] ?? [])).toEqual({
      client_id: 'client-1',
      client_secret: 'secret-1',
      scope,
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: 'https://app.test/api/microsoft/callback',
      code_verifier: 'verifier-1',
    });
  });

  it('refreshes with the refresh token, and keeps it when Microsoft sends no new one', async () => {
    const api = tokenApi({ rotates: false });
    const auth = new MicrosoftIdentityAuthorization(client, api.fetchFn);
    const granted = await auth.exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/cb',
      teams: false,
    });
    if (!granted.ok) throw new Error('exchange failed');
    expect(await auth.refresh(granted.value.refreshToken, { teams: false })).toEqual({
      ok: true,
      value: { accessToken: 'access-2', refreshToken: granted.value.refreshToken },
    });
    expect(Object.fromEntries(api.calls[1] ?? [])).toEqual({
      client_id: 'client-1',
      client_secret: 'secret-1',
      scope,
      grant_type: 'refresh_token',
      refresh_token: granted.value.refreshToken,
    });
  });

  it('takes the new refresh token when Microsoft sends one', async () => {
    const auth = new MicrosoftIdentityAuthorization(client, tokenApi().fetchFn);
    const granted = await auth.exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/cb',
      teams: false,
    });
    if (!granted.ok) throw new Error('exchange failed');
    expect(await auth.refresh(granted.value.refreshToken, { teams: false })).toEqual({
      ok: true,
      value: { accessToken: 'access-2', refreshToken: 'refresh-2' },
    });
  });

  it('asks for the Teams permissions only on refreshes that need them', async () => {
    const api = tokenApi();
    const auth = new MicrosoftIdentityAuthorization(client, api.fetchFn);
    const granted = await auth.exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/cb',
      teams: true,
    });
    expect(granted).toEqual({ ok: true, value: { refreshToken: 'refresh-1', teams: true } });
    expect(api.calls[0]?.get('scope')).toBe(teamsScope);
    const oneDrive = await auth.refresh('refresh-1', { teams: false });
    expect(api.calls[1]?.get('scope')).toBe(scope);
    if (!oneDrive.ok) throw new Error('refresh failed');
    expect((await auth.refresh(oneDrive.value.refreshToken, { teams: true })).ok).toBe(true);
    expect(api.calls[2]?.get('scope')).toBe(teamsScope);
  });

  it("tells a personal account's grant, which comes back without Teams", async () => {
    const auth = new MicrosoftIdentityAuthorization(
      client,
      tokenApi({ schoolAccount: false }).fetchFn,
    );
    const granted = await auth.exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/cb',
      teams: true,
    });
    expect(granted).toEqual({ ok: true, value: { refreshToken: 'refresh-1', teams: false } });
    expect(await auth.refresh('refresh-1', { teams: true })).toEqual({
      ok: false,
      error: { code: 'insufficient_scope' },
    });
    expect((await auth.refresh('refresh-1', { teams: false })).ok).toBe(true);
  });

  it('takes a grant whose response does not list its scopes as covering what was asked', async () => {
    const auth = new MicrosoftIdentityAuthorization(
      client,
      respond(200, { access_token: 'a', refresh_token: 'r', token_type: 'Bearer' }),
    );
    expect(
      await auth.exchangeCode({
        code: 'c',
        codeVerifier: 'v',
        redirectUri: 'https://a.test',
        teams: true,
      }),
    ).toEqual({ ok: true, value: { refreshToken: 'r', teams: true } });
  });

  it('refuses Teams on a refresh that comes back without the Teams scopes', async () => {
    const auth = new MicrosoftIdentityAuthorization(
      client,
      respond(200, { access_token: 'a', scope: 'https://graph.microsoft.com/User.Read' }),
    );
    expect(await auth.refresh('r', { teams: true })).toEqual({
      ok: false,
      error: { code: 'insufficient_scope' },
    });
  });

  it('tells revoked access from a busy or unreachable Microsoft', async () => {
    for (const [fetchFn, code] of [
      [respond(400, { error: 'invalid_grant' }), 'unauthorized'],
      [respond(400, { error: 'invalid_grant', error_codes: [65001] }), 'unauthorized'],
      [respond(400, { error: 'invalid_request' }), 'unavailable'],
      [respond(400, { unexpected: true }), 'unavailable'],
      [respond(401, { error: 'invalid_client' }), 'unavailable'],
      [respond(429, { error: 'temporarily_unavailable' }), 'throttled'],
      [respond(500, { error: 'server_error' }), 'unavailable'],
      [respond(200, { token_type: 'Bearer' }), 'unavailable'],
      [() => Promise.reject(new Error('down')), 'unavailable'],
    ] as const) {
      expect(
        await new MicrosoftIdentityAuthorization(client, fetchFn).refresh('r', { teams: false }),
      ).toEqual({ ok: false, error: { code } });
    }
  });

  it('reads a missing consent on a Teams refresh as Teams no longer allowed', async () => {
    for (const body of [
      { error: 'invalid_grant', error_codes: [65001] },
      { error: 'consent_required' },
      { error: 'invalid_scope' },
    ]) {
      expect(
        await new MicrosoftIdentityAuthorization(client, respond(400, body)).refresh('r', {
          teams: true,
        }),
      ).toEqual({ ok: false, error: { code: 'insufficient_scope' } });
    }
    expect(
      await new MicrosoftIdentityAuthorization(
        client,
        respond(400, { error: 'invalid_grant', error_codes: [70000] }),
      ).refresh('r', { teams: true }),
    ).toEqual({ ok: false, error: { code: 'unauthorized' } });
  });

  it('refuses an exchange that comes back without a refresh token', async () => {
    const auth = new MicrosoftIdentityAuthorization(
      client,
      respond(200, { access_token: 'a', token_type: 'Bearer' }),
    );
    expect(
      await auth.exchangeCode({
        code: 'c',
        codeVerifier: 'v',
        redirectUri: 'https://a.test',
        teams: false,
      }),
    ).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('reads the refusals Microsoft sends back instead of a code', () => {
    const auth = new MicrosoftIdentityAuthorization(client);
    expect(
      auth.refusal({
        error: 'access_denied',
        description: 'AADSTS90094: Administrator consent is required.',
      }),
    ).toEqual({ code: 'admin_approval_required' });
  });
});

describe('microsoftRefusal', () => {
  it("names the school administrator's approval, a school account, or a declined consent", () => {
    for (const [error, description, code] of [
      ['access_denied', 'AADSTS90094: AdminConsentRequired', 'admin_approval_required'],
      [
        'consent_required',
        'AADSTS90095: AdminConsentRequiredRequestAccess',
        'admin_approval_required',
      ],
      ['invalid_scope', null, 'school_account_required'],
      [
        'invalid_request',
        'AADSTS70011: The provided value for scope is not valid.',
        'school_account_required',
      ],
      ['access_denied', 'AADSTS65004: User declined to consent to access the app.', 'declined'],
      ['access_denied', null, 'declined'],
      ['consent_required', null, 'declined'],
      ['interaction_required', null, 'declined'],
      ['server_error', null, 'unavailable'],
      ['temporarily_unavailable', 'busy', 'unavailable'],
    ] as const) {
      expect(microsoftRefusal({ error, description })).toEqual({ code });
    }
  });

  it('is what the local stand-in reads too', () => {
    expect(
      new LocalMicrosoftAuthorization().refusal({ error: 'access_denied', description: null }),
    ).toEqual({ code: 'declined' });
  });
});

describe('LocalMicrosoftAuthorization', () => {
  it('grants Teams when asked, through a code that says so', async () => {
    const auth = new LocalMicrosoftAuthorization();
    const codeVerifier = 'v';
    const back = new URL(
      auth.authorizationUrl({
        state: 's',
        codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
        redirectUri: 'https://a.test/cb',
        teams: true,
      }),
    );
    const code = back.searchParams.get('code') ?? '';
    expect(code).toContain('teams');
    const granted = await auth.exchangeCode({ code, codeVerifier, teams: true });
    if (!granted.ok) throw new Error('exchange failed');
    expect(granted.value.teams).toBe(true);
    expect(await auth.refresh(granted.value.refreshToken, { teams: true })).toEqual({
      ok: true,
      value: {
        accessToken: localMicrosoftFixture.teamsAccessToken,
        refreshToken: granted.value.refreshToken,
      },
    });
  });
});

describe('OneDriveGraphFiles', () => {
  const file = {
    name: 'Fracciones #1 🍎 100%.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: new Uint8Array([0x50, 0x4b, 3, 4]),
  };

  it('puts the file in the TeacherHubPro folder, keeping any file with the same name', async () => {
    const api = driveApi('t');
    expect(await new OneDriveGraphFiles(api.fetchFn).upload('t', file)).toEqual({
      ok: true,
      value: {
        webUrl: `https://contoso-my.sharepoint.com/personal/ana/Documents/TeacherHubPro/${encodeURIComponent(file.name)}`,
      },
    });
    const sent = api.puts[0];
    expect(sent?.url).toBe(
      `https://graph.microsoft.com/v1.0/me/drive/root:/TeacherHubPro/${encodeURIComponent(file.name)}:/content?@microsoft.graph.conflictBehavior=rename`,
    );
    expect(sent?.headers.get('content-type')).toBe(file.mimeType);
    expect(sent?.body).toEqual(file.bytes);
    expect(sent?.body).not.toBe(file.bytes);
  });

  it('tells expired access from a busy or unreachable OneDrive', async () => {
    for (const [fetchFn, code] of [
      [respond(401, { error: { code: 'InvalidAuthenticationToken' } }), 'unauthorized'],
      [respond(429, { error: { code: 'tooManyRequests' } }), 'throttled'],
      [respond(503, { error: { code: 'serviceNotAvailable' } }), 'throttled'],
      [respond(507, { error: { code: 'quotaLimitReached' } }), 'unavailable'],
      [respond(201, { id: 'no-link' }), 'unavailable'],
      [() => Promise.reject(new Error('down')), 'unavailable'],
    ] as const) {
      expect(await new OneDriveGraphFiles(fetchFn).upload('t', file)).toEqual({
        ok: false,
        error: { code },
      });
    }
  });
});
