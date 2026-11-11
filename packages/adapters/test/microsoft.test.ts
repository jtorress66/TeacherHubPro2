import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { microsoftAuthorizationContract, oneDriveFilesContract } from '@thp/testing';
import {
  MicrosoftIdentityAuthorization,
  OneDriveGraphFiles,
} from '../src/microsoft/microsoft-graph.ts';
import {
  LocalMicrosoftAuthorization,
  LocalOneDriveFiles,
  localMicrosoftFixture,
} from '../src/microsoft/local-microsoft.ts';

const client = { clientId: 'client-1', clientSecret: 'secret-1' };
const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const scope = 'openid offline_access User.Read Files.ReadWrite';
const urlOf = (input: string | URL | Request) =>
  input instanceof Request ? input.url : input.toString();

/**
 * The Microsoft identity platform's token endpoint, as documented: a refresh may come back with
 * a new refresh token (`rotates`) or without one.
 */
function tokenApi({ rotates = true } = {}) {
  const live = new Set<string>();
  let issued = 0;
  const calls: URLSearchParams[] = [];
  const grant = (refreshToken: string | null) => {
    issued += 1;
    return Response.json({
      token_type: 'Bearer',
      scope: 'User.Read Files.ReadWrite',
      expires_in: 3599,
      access_token: `access-${String(issued)}`,
      ...(refreshToken === null ? {} : { refresh_token: refreshToken }),
    });
  };
  const next = () => {
    const token = `refresh-${String(issued + 1)}`;
    live.add(token);
    return grant(token);
  };
  const invalidGrant = () =>
    Response.json(
      { error: 'invalid_grant', error_description: 'AADSTS70000: expired.' },
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
        ? next()
        : invalidGrant();
    }
    const used = body.get('refresh_token') ?? '';
    if (!live.has(used)) return invalidGrant();
    if (!rotates) return grant(null);
    live.delete(used);
    return next();
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
    }),
  );
  return { auth, code: back.searchParams.get('code') ?? '', codeVerifier };
});
oneDriveFilesContract('OneDriveGraphFiles', () => ({
  files: new OneDriveGraphFiles(driveApi('access-1').fetchFn),
  accessToken: 'access-1',
}));
oneDriveFilesContract('LocalOneDriveFiles', () => ({
  files: new LocalOneDriveFiles(),
  accessToken: localMicrosoftFixture.accessToken,
}));

describe('MicrosoftIdentityAuthorization', () => {
  it('asks for OneDrive files and offline access, with the S256 PKCE method', () => {
    const url = new URL(
      new MicrosoftIdentityAuthorization(client).authorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        redirectUri: 'https://app.test/api/microsoft/callback',
      }),
    );
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

  it('sends the code with its verifier, return address, scopes and the client credentials', async () => {
    const api = tokenApi();
    await new MicrosoftIdentityAuthorization(client, api.fetchFn).exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/api/microsoft/callback',
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
    });
    if (!granted.ok) throw new Error('exchange failed');
    expect(await auth.refresh(granted.value.refreshToken)).toEqual({
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
    });
    if (!granted.ok) throw new Error('exchange failed');
    expect(await auth.refresh(granted.value.refreshToken)).toEqual({
      ok: true,
      value: { accessToken: 'access-2', refreshToken: 'refresh-2' },
    });
  });

  it('tells revoked access from a busy or unreachable Microsoft', async () => {
    for (const [fetchFn, code] of [
      [respond(400, { error: 'invalid_grant' }), 'unauthorized'],
      [respond(400, { error: 'invalid_request' }), 'unavailable'],
      [respond(401, { error: 'invalid_client' }), 'unavailable'],
      [respond(429, { error: 'temporarily_unavailable' }), 'throttled'],
      [respond(500, { error: 'server_error' }), 'unavailable'],
      [respond(200, { token_type: 'Bearer' }), 'unavailable'],
      [() => Promise.reject(new Error('down')), 'unavailable'],
    ] as const) {
      expect(await new MicrosoftIdentityAuthorization(client, fetchFn).refresh('r')).toEqual({
        ok: false,
        error: { code },
      });
    }
  });

  it('refuses an exchange that comes back without a refresh token', async () => {
    const auth = new MicrosoftIdentityAuthorization(
      client,
      respond(200, { access_token: 'a', token_type: 'Bearer' }),
    );
    expect(
      await auth.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'https://a.test' }),
    ).toEqual({ ok: false, error: { code: 'unavailable' } });
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
