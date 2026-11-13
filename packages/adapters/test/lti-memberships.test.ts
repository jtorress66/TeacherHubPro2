import { decodeJwt, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { checkLaunch, learnersFrom, type LtiPlatformId, type SchoolId } from '@thp/domain';
import type { PublicJwk, ToolJwtSigner, ToolKeyStore } from '@thp/ports';
import {
  anLtiPlatform,
  FakeToolKeyStore,
  FixedClock,
  ltiMembershipsClientContract,
  SequentialTokenGenerator,
} from '@thp/testing';
import { HttpLtiMembershipsClient } from '../src/lti/http-lti-memberships-client.ts';
import { LocalLtiPlatform } from '../src/lti/local-lti-platform.ts';

// Recorded shapes: the IMS LTI Names and Role Provisioning Services 2.0 membership container and
// the OAuth 2 client credentials grant of the LTI Advantage security framework, as Canvas and
// Moodle answer them. Nothing calls a real course system.

const server = setupServer();
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const platform = anLtiPlatform();
const membershipsUrl = 'https://lms.example.edu/api/lti/courses/9/names_and_roles';
const clock = new FixedClock(new Date('2026-11-13T12:00:00Z'));
const nrpsType = 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json';
const scope = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

const client = () =>
  new HttpLtiMembershipsClient({
    signer: new FakeToolKeyStore(),
    clock,
    tokens: new SequentialTokenGenerator(),
  });

const containerOf = (members: readonly unknown[]) => ({
  id: membershipsUrl,
  context: { id: 'course-9', label: 'SCI5', title: 'Science 5' },
  members,
});

/** A token endpoint that grants `bearer-1`, and a class list that wants it. */
function courseSystem(members: readonly unknown[], options: { tokenStatus?: number } = {}) {
  const sent: { form?: URLSearchParams; listHeaders?: Headers } = {};
  server.use(
    http.post(platform.authTokenUrl, async ({ request }) => {
      sent.form = new URLSearchParams(await request.text());
      if (options.tokenStatus !== undefined) {
        return HttpResponse.json({ error: 'invalid_client' }, { status: options.tokenStatus });
      }
      return HttpResponse.json({
        access_token: 'bearer-1',
        token_type: 'Bearer',
        expires_in: 3600,
        scope,
      });
    }),
    http.get(membershipsUrl, ({ request }) => {
      sent.listHeaders = request.headers;
      if (request.headers.get('authorization') !== 'Bearer bearer-1') {
        return new HttpResponse(null, { status: 401 });
      }
      return HttpResponse.json(containerOf(members), { headers: { 'Content-Type': nrpsType } });
    }),
  );
  return sent;
}

ltiMembershipsClientContract('HttpLtiMembershipsClient', (setup) => {
  if (setup.refusal === 'not_allowed') courseSystem(setup.members, { tokenStatus: 401 });
  else if (setup.refusal === 'unavailable') courseSystem(setup.members, { tokenStatus: 500 });
  else courseSystem(setup.members);
  return { client: client(), platform, membershipsUrl };
});

describe('HttpLtiMembershipsClient', () => {
  const ana = { user_id: 'lms-1', roles: ['Learner'], given_name: 'Ana', family_name: 'Rivera' };

  it('asks for a class list token with a client assertion signed by the tool', async () => {
    const sent = courseSystem([ana]);

    expect((await client().listMembers(platform, membershipsUrl)).ok).toBe(true);

    expect(Object.fromEntries(sent.form ?? [])).toMatchObject({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      scope,
    });
    const seconds = clock.now().getTime() / 1000;
    expect(decodeJwt(sent.form?.get('client_assertion') ?? '')).toEqual({
      iss: platform.clientId,
      sub: platform.clientId,
      aud: platform.authTokenUrl,
      iat: seconds,
      exp: seconds + 300,
      jti: 'token-00000000000000000000000000000001',
    });
    expect(sent.listHeaders?.get('accept')).toBe(nrpsType);
  });

  it('reads every page of a long class list', async () => {
    courseSystem([]);
    const page = (n: number) => `${membershipsUrl}?page=${String(n)}`;
    server.use(
      http.get(membershipsUrl, ({ request }) => {
        const n = Number(new URL(request.url).searchParams.get('page') ?? '1');
        const next =
          n < 3 ? { Link: `<${page(n + 1)}>; rel="next", <${page(1)}>; rel="first"` } : {};
        return HttpResponse.json(containerOf([{ user_id: `lms-${String(n)}` }]), {
          headers: next,
        });
      }),
    );

    expect(await client().listMembers(platform, membershipsUrl)).toEqual({
      ok: true,
      value: [{ user_id: 'lms-1' }, { user_id: 'lms-2' }, { user_id: 'lms-3' }],
    });
  });

  it('stops after fifty pages, and never follows a page on another site', async () => {
    courseSystem([]);
    let pages = 0;
    server.use(
      http.get(membershipsUrl, () => {
        pages += 1;
        return HttpResponse.json(containerOf([]), {
          headers: { Link: `<${membershipsUrl}?page=${String(pages + 1)}>; rel="next"` },
        });
      }),
    );
    expect((await client().listMembers(platform, membershipsUrl)).ok).toBe(true);
    expect(pages).toBe(50);

    server.use(
      http.get(membershipsUrl, () =>
        HttpResponse.json(containerOf([ana]), {
          headers: { Link: '<https://evil.example/steal>; rel="next"' },
        }),
      ),
    );
    expect(await client().listMembers(platform, membershipsUrl)).toEqual({
      ok: true,
      value: [ana],
    });
  });

  it.each([
    ['a refused class list', () => new HttpResponse(null, { status: 403 }), 'not_allowed'],
    ['a failing class list', () => new HttpResponse(null, { status: 503 }), 'unavailable'],
    ['a list that is not JSON', () => new HttpResponse('<html>', { status: 200 }), 'unavailable'],
    ['a list without members', () => HttpResponse.json({ id: membershipsUrl }), 'unavailable'],
    ['a network failure', () => HttpResponse.error(), 'unavailable'],
  ] as const)('reports %s', async (_case, answer, error) => {
    courseSystem([]);
    server.use(http.get(membershipsUrl, answer));

    expect(await client().listMembers(platform, membershipsUrl)).toEqual({ ok: false, error });
  });

  it('reports a token answer without a token, or a forbidden token request', async () => {
    courseSystem([]);
    server.use(http.post(platform.authTokenUrl, () => HttpResponse.json({ token_type: 'Bearer' })));
    expect(await client().listMembers(platform, membershipsUrl)).toEqual({
      ok: false,
      error: 'unavailable',
    });

    courseSystem([], { tokenStatus: 403 });
    expect(await client().listMembers(platform, membershipsUrl)).toEqual({
      ok: false,
      error: 'not_allowed',
    });
  });
});

/** A real RSA tool key, as the tool key store keeps it, for the pretend course system to check. */
class TestToolKeys implements ToolKeyStore, ToolJwtSigner {
  private keys: Promise<{ privateKey: CryptoKey; jwk: PublicJwk }> | undefined;

  constructor(private readonly kid = 'tool-key-1') {}

  async publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }> {
    return { keys: [(await this.pair()).jwk] };
  }

  async sign(claims: Readonly<Record<string, unknown>>): Promise<string> {
    const { privateKey } = await this.pair();
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .sign(privateKey);
  }

  private pair() {
    this.keys ??= (async () => {
      const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
      const { kty = 'RSA', n = '', e = '' } = await exportJWK(publicKey);
      return { privateKey, jwk: { kty, n, e, kid: this.kid, alg: 'RS256', use: 'sig' } };
    })();
    return this.keys;
  }
}

describe('LocalLtiPlatform class lists', () => {
  const appUrl = 'http://localhost:3100';
  const lms = new LocalLtiPlatform({
    issuer: `${appUrl}/test-lms`,
    jwksUrl: `${appUrl}/api/test-lms/jwks`,
    tokenUrl: `${appUrl}/api/test-lms/token`,
    membershipsUrl: `${appUrl}/api/test-lms/memberships`,
    clock,
  });
  const testPlatform = anLtiPlatform({
    issuer: lms.issuer,
    clientId: 'client-1',
    authTokenUrl: `${appUrl}/api/test-lms/token`,
  });
  const toolKeys = new TestToolKeys();

  const assertion = (overrides: Record<string, unknown> = {}, keys: ToolJwtSigner = toolKeys) => {
    const seconds = clock.now().getTime() / 1000;
    return keys.sign({
      iss: 'client-1',
      sub: 'client-1',
      aud: `${appUrl}/api/test-lms/token`,
      iat: seconds,
      exp: seconds + 300,
      jti: 'j-1',
      ...overrides,
    });
  };
  const request = async (overrides: Record<string, string | null> = {}) => ({
    grantType: 'client_credentials',
    clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    clientAssertion: await assertion(),
    scope,
    ...overrides,
  });

  it('offers the course’s class list in its launches', async () => {
    const token = await lms.launchToken({
      clientId: 'client-1',
      subject: 'teacher-1',
      role: 'teacher',
      nonce: 'nonce-1',
    });
    const launch = checkLaunch(decodeJwt(token), {
      platform: {
        ...testPlatform,
        id: 'p' as LtiPlatformId,
        schoolId: 's' as SchoolId,
        deploymentIds: [LocalLtiPlatform.deploymentId],
      },
      expectedNonce: 'nonce-1',
      now: clock.now(),
    });

    expect(launch.ok && launch.value.membershipsUrl).toBe(`${appUrl}/api/test-lms/memberships`);
  });

  it('grants a class list token only for the tool’s own signed assertion', async () => {
    const keys = await toolKeys.publicKeySet();
    expect(await lms.grantServiceToken(await request(), keys)).toEqual(expect.any(String));

    const refused = [
      await request({ clientAssertion: await assertion({}, new TestToolKeys()) }),
      await request({ clientAssertion: await assertion({ aud: 'https://elsewhere.example' }) }),
      await request({ clientAssertion: await assertion({ sub: 'someone-else' }) }),
      await request({ clientAssertion: await assertion({ exp: 1 }) }),
      await request({ grantType: 'password' }),
      await request({ clientAssertionType: null }),
      await request({ scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score' }),
      await request({ clientAssertion: 'not.a.token' }),
    ];
    for (const bad of refused) expect(await lms.grantServiceToken(bad, keys)).toBeNull();
  });

  it('serves its class list only with a token it granted', async () => {
    const granted = await lms.grantServiceToken(await request(), await toolKeys.publicKeySet());

    const list = await lms.classList(`Bearer ${granted ?? ''}`);
    expect(list?.context).toEqual({ id: 'test-course', label: 'TEST', title: 'Test course' });
    expect(learnersFrom(list?.members)).toEqual({
      learners: [
        { subject: 'student-1', firstName: 'Ana', lastName: 'Rivera' },
        { subject: 'student-2', firstName: 'Ben', lastName: 'Ortiz' },
      ],
      noName: 1,
    });

    for (const bad of [null, 'Bearer ', `Basic ${granted ?? ''}`, `Bearer ${await assertion()}`]) {
      expect(await lms.classList(bad)).toBeNull();
    }
  });

  it('works end to end with the class list client', async () => {
    const keys = await toolKeys.publicKeySet();
    server.use(
      http.post(`${appUrl}/api/test-lms/token`, async ({ request: posted }) => {
        const form = new URLSearchParams(await posted.text());
        const token = await lms.grantServiceToken(
          {
            grantType: form.get('grant_type'),
            clientAssertionType: form.get('client_assertion_type'),
            clientAssertion: form.get('client_assertion'),
            scope: form.get('scope'),
          },
          keys,
        );
        return token === null
          ? HttpResponse.json({ error: 'invalid_client' }, { status: 401 })
          : HttpResponse.json({ access_token: token, token_type: 'Bearer', expires_in: 300 });
      }),
      http.get(`${appUrl}/api/test-lms/memberships`, async ({ request: asked }) => {
        const list = await lms.classList(asked.headers.get('authorization'));
        return list === null ? new HttpResponse(null, { status: 401 }) : HttpResponse.json(list);
      }),
    );
    const listClient = new HttpLtiMembershipsClient({
      signer: toolKeys,
      clock,
      tokens: new SequentialTokenGenerator(),
    });

    const members = await listClient.listMembers(
      testPlatform,
      `${appUrl}/api/test-lms/memberships`,
    );

    expect(members.ok && learnersFrom(members.value).learners).toHaveLength(2);
  });
});
