import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canvaAuthorizationContract, canvaDesignsContract } from '@thp/testing';
import { CanvaConnectAuthorization, CanvaConnectDesigns } from '../src/canva/canva-connect.ts';
import {
  LocalCanvaAuthorization,
  LocalCanvaDesigns,
  localCanvaFixture,
} from '../src/canva/local-canva.ts';

const client = { clientId: 'client-1', clientSecret: 'secret-1' };
const basic = `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`;
const urlOf = (input: string | URL | Request) =>
  input instanceof Request ? input.url : input.toString();

/** Canva's token endpoint, as documented: each refresh token works once. */
function tokenApi() {
  const live = new Set<string>();
  let issued = 0;
  const calls: URLSearchParams[] = [];
  const next = () => {
    issued += 1;
    const token = `refresh-${String(issued)}`;
    live.add(token);
    return Response.json({
      access_token: `access-${String(issued)}`,
      refresh_token: token,
      token_type: 'Bearer',
      expires_in: 14400,
    });
  };
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve();
    expect(urlOf(input)).toBe('https://api.canva.com/rest/v1/oauth/token');
    if (new Headers(init?.headers).get('authorization') !== basic) {
      return Response.json({ code: 'invalid_client' }, { status: 401 });
    }
    const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    calls.push(body);
    if (body.get('grant_type') === 'authorization_code') {
      return body.get('code') === 'code-1' && body.get('code_verifier') === 'verifier-1'
        ? next()
        : Response.json({ code: 'invalid_grant' }, { status: 400 });
    }
    return live.delete(body.get('refresh_token') ?? '')
      ? next()
      : Response.json({ code: 'invalid_grant' }, { status: 400 });
  };
  return { fetchFn, calls };
}

/** Canva's design imports: the job is in progress once, then done (or failed). */
function importApi(accessToken: string, outcome: object = { status: 'success' }) {
  const posts: { headers: Headers; body: unknown }[] = [];
  let checks = 0;
  const done = {
    job: {
      id: 'job-1',
      ...outcome,
      ...('error' in outcome
        ? {}
        : {
            result: {
              designs: [{ id: 'D1', urls: { edit_url: 'https://www.canva.com/d/D1/edit' } }],
            },
          }),
    },
  };
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve();
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${accessToken}`) {
      return Response.json({ code: 'invalid_access_token' }, { status: 401 });
    }
    if (init?.method === 'POST') {
      expect(urlOf(input)).toBe('https://api.canva.com/rest/v1/imports');
      posts.push({ headers, body: init.body });
      return Response.json({ job: { id: 'job-1', status: 'in_progress' } });
    }
    expect(urlOf(input)).toBe('https://api.canva.com/rest/v1/imports/job-1');
    checks += 1;
    return Response.json(checks < 2 ? { job: { id: 'job-1', status: 'in_progress' } } : done);
  };
  return { fetchFn, posts, checks: () => checks };
}

const noWait = () => Promise.resolve();

canvaAuthorizationContract('CanvaConnectAuthorization', () => ({
  auth: new CanvaConnectAuthorization(client, tokenApi().fetchFn),
  code: 'code-1',
  codeVerifier: 'verifier-1',
}));
canvaAuthorizationContract('LocalCanvaAuthorization', () => {
  const auth = new LocalCanvaAuthorization();
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
canvaDesignsContract('CanvaConnectDesigns', () => ({
  designs: new CanvaConnectDesigns(importApi('access-1').fetchFn, noWait),
  accessToken: 'access-1',
}));
canvaDesignsContract('LocalCanvaDesigns', () => ({
  designs: new LocalCanvaDesigns(),
  accessToken: localCanvaFixture.accessToken,
}));

describe('CanvaConnectAuthorization', () => {
  it("asks only for the import scope, with Canva's PKCE method", () => {
    const url = new URL(
      new CanvaConnectAuthorization(client).authorizationUrl({
        state: 'state-1',
        codeChallenge: 'challenge-1',
        redirectUri: 'https://app.test/api/canva/callback',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://www.canva.com/api/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://app.test/api/canva/callback',
      scope: 'design:content:write',
      state: 'state-1',
      code_challenge: 'challenge-1',
      code_challenge_method: 's256',
    });
  });

  it('sends the code with its verifier and return address, the secret only in the Basic header', async () => {
    const api = tokenApi();
    await new CanvaConnectAuthorization(client, api.fetchFn).exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/api/canva/callback',
    });
    expect(Object.fromEntries(api.calls[0] ?? [])).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'https://app.test/api/canva/callback',
    });
  });

  it('treats a refresh token used twice as revoked, and a network failure as unavailable', async () => {
    const api = tokenApi();
    const auth = new CanvaConnectAuthorization(client, api.fetchFn);
    const granted = await auth.exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://app.test/cb',
    });
    if (!granted.ok) throw new Error('exchange failed');
    expect((await auth.refresh(granted.value.refreshToken)).ok).toBe(true);
    expect(await auth.refresh(granted.value.refreshToken)).toEqual({
      ok: false,
      error: { code: 'unauthorized' },
    });
    const offline = new CanvaConnectAuthorization(client, () => Promise.reject(new Error('down')));
    expect(await offline.refresh('refresh-1')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});

describe('CanvaConnectDesigns', () => {
  const file = {
    title: 'Fracciones 🍎',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: new Uint8Array([0x50, 0x4b, 3, 4]),
  };

  it('sends the raw file with its title in base64, then waits for the design', async () => {
    const api = importApi('t');
    const waits: number[] = [];
    const designs = new CanvaConnectDesigns(api.fetchFn, (ms) => {
      waits.push(ms);
      return Promise.resolve();
    });

    expect(await designs.importFile('t', file)).toEqual({
      ok: true,
      value: { editUrl: 'https://www.canva.com/d/D1/edit' },
    });
    const sent = api.posts[0];
    expect(sent?.body).toEqual(file.bytes);
    expect(sent?.headers.get('content-type')).toBe('application/octet-stream');
    expect(JSON.parse(sent?.headers.get('import-metadata') ?? '{}')).toEqual({
      title_base64: Buffer.from('Fracciones 🍎').toString('base64'),
      mime_type: file.mimeType,
    });
    expect(api.checks()).toBe(2);
    expect(waits).toEqual([1000, 1000]);
  });

  it("reports Canva's reason when the import fails", async () => {
    for (const [code, expected] of [
      ['invalid_file', 'invalid_file'],
      ['design_import_throttled', 'throttled'],
      ['internal_error', 'unavailable'],
    ] as const) {
      const api = importApi('t', { status: 'failed', error: { code, message: 'no' } });
      expect(await new CanvaConnectDesigns(api.fetchFn, noWait).importFile('t', file)).toEqual({
        ok: false,
        error: { code: expected },
      });
    }
  });

  it('gives up after its checks run out, and when Canva is unreachable or busy', async () => {
    const stuck = async () => {
      await Promise.resolve();
      return Response.json({ job: { id: 'job-1', status: 'in_progress' } });
    };
    expect(await new CanvaConnectDesigns(stuck, noWait, 3).importFile('t', file)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
    const offline = () => Promise.reject(new Error('down'));
    expect(await new CanvaConnectDesigns(offline, noWait).importFile('t', file)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
    const busy = async () => {
      await Promise.resolve();
      return Response.json({ code: 'too_many_requests' }, { status: 429 });
    };
    expect(await new CanvaConnectDesigns(busy, noWait).importFile('t', file)).toEqual({
      ok: false,
      error: { code: 'throttled' },
    });
  });
});
