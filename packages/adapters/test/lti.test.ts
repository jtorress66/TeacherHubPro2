import { createLocalJWKSet, decodeJwt, decodeProtectedHeader, type JWTVerifyGetKey } from 'jose';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  checkLaunch,
  deepLinkingResponse,
  ltiClaim,
  ltiRoles,
  type GameId,
  type LtiPlatform,
  type LtiPlatformId,
  type SchoolId,
} from '@thp/domain';
import { FixedClock, ltiTokenVerifierContract } from '@thp/testing';
import { JoseLtiTokenVerifier } from '../src/lti/jose-lti-token-verifier.ts';
import { LocalLtiPlatform } from '../src/lti/local-lti-platform.ts';

const jwksUrl = 'https://lms.example.edu/jwks';
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

/** Reads the platform's keys directly, as a key-set resolver. */
const localKeys =
  (platform: LocalLtiPlatform): JWTVerifyGetKey =>
  async (header, token) =>
    createLocalJWKSet({ keys: [...(await platform.publicKeySet()).keys] })(header, token);

const pair = () => {
  const platform = new LocalLtiPlatform({ issuer: 'https://lms.example.edu', jwksUrl });
  const other = new LocalLtiPlatform({ issuer: 'https://lms.example.edu', jwksUrl });
  return {
    platform,
    issuer: {
      jwksUrl,
      sign: (claims: Readonly<Record<string, unknown>>) => platform.sign(claims),
      signWithOtherKey: (claims: Readonly<Record<string, unknown>>) => other.sign(claims),
    },
  };
};

ltiTokenVerifierContract('JoseLtiTokenVerifier (key set resolver)', () => {
  const { platform, issuer } = pair();
  return { verifier: new JoseLtiTokenVerifier(() => localKeys(platform)), issuer };
});

ltiTokenVerifierContract('JoseLtiTokenVerifier (key set fetched over HTTPS)', () => {
  const { platform, issuer } = pair();
  server.use(http.get(jwksUrl, async () => HttpResponse.json(await platform.publicKeySet())));
  return { verifier: new JoseLtiTokenVerifier(), issuer };
});

describe('JoseLtiTokenVerifier', () => {
  it('fetches each course system’s key set once and reuses it', async () => {
    const { platform, issuer } = pair();
    let fetched = 0;
    server.use(
      http.get(jwksUrl, async () => {
        fetched += 1;
        return HttpResponse.json(await platform.publicKeySet());
      }),
    );
    const verifier = new JoseLtiTokenVerifier();
    const claims = { iss: 'https://lms.example.edu', aud: 'c', exp: Date.now() / 1000 + 60 };
    const check = { jwksUrl, issuer: 'https://lms.example.edu', audience: 'c' };

    expect((await verifier.verify(await issuer.sign(claims), check)).ok).toBe(true);
    expect((await verifier.verify(await issuer.sign(claims), check)).ok).toBe(true);
    expect(fetched).toBe(1);
  });

  it('judges expiry by the given clock', async () => {
    const { platform, issuer } = pair();
    const clock = new FixedClock(new Date('2026-11-12T12:00:00Z'));
    const verifier = new JoseLtiTokenVerifier(() => localKeys(platform), clock);
    const exp = clock.now().getTime() / 1000 + 60;
    const token = await issuer.sign({ iss: 'https://lms.example.edu', aud: 'c', exp });
    const check = { jwksUrl, issuer: 'https://lms.example.edu', audience: 'c' };

    expect((await verifier.verify(token, check)).ok).toBe(true);
    clock.advanceBy(61_000);
    expect(await verifier.verify(token, check)).toEqual({ ok: false, error: 'invalid_token' });
  });

  it('refuses a key set that cannot be fetched', async () => {
    const { issuer } = pair();
    server.use(http.get(jwksUrl, () => new HttpResponse(null, { status: 500 })));
    const token = await issuer.sign({ iss: 'i', aud: 'c', exp: Date.now() / 1000 + 60 });

    expect(
      await new JoseLtiTokenVerifier().verify(token, { jwksUrl, issuer: 'i', audience: 'c' }),
    ).toEqual({ ok: false, error: 'invalid_token' });
  });
});

describe('LocalLtiPlatform', () => {
  const clock = new FixedClock(new Date('2026-11-12T12:00:00Z'));
  const platform = new LocalLtiPlatform({
    issuer: 'http://localhost:3100/test-lms',
    jwksUrl: 'http://localhost:3100/api/test-lms/jwks',
    clock,
  });
  /** The pretend course system as a school registers it. */
  const registered: LtiPlatform = {
    id: 'p' as LtiPlatformId,
    schoolId: 's' as SchoolId,
    name: 'Test LMS',
    issuer: 'http://localhost:3100/test-lms',
    clientId: 'client-1',
    deploymentIds: [LocalLtiPlatform.deploymentId],
    authLoginUrl: 'http://localhost:3100/api/test-lms/authorize',
    authTokenUrl: 'http://localhost:3100/api/test-lms/token',
    jwksUrl: 'http://localhost:3100/api/test-lms/jwks',
    createdAt: clock.now(),
  };

  it('publishes one public RS256 key, without its private half', async () => {
    const set = await platform.publicKeySet();
    expect(set.keys).toHaveLength(1);
    expect(set.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', kid: 'test-lms' });
    expect(set.keys[0]).not.toHaveProperty('d');
    expect(await platform.publicKeySet()).toEqual(set);
  });

  it('signs a teacher’s resource link launch that the domain accepts', async () => {
    const token = await platform.launchToken({
      clientId: 'client-1',
      subject: 'teacher-1',
      role: 'teacher',
      nonce: 'nonce-1',
    });

    expect(decodeProtectedHeader(token)).toMatchObject({ alg: 'RS256', kid: 'test-lms' });
    const launch = checkLaunch(decodeJwt(token), {
      platform: registered,
      expectedNonce: 'nonce-1',
      now: clock.now(),
    });
    expect(launch.ok && launch.value).toMatchObject({
      subject: 'teacher-1',
      role: 'teacher',
      contextTitle: 'Test course',
    });
  });

  it('resolves its own key set directly and any other address over the network', async () => {
    const remote: JWTVerifyGetKey = () => Promise.reject(new Error('fetched'));
    const resolve = platform.keyResolver(() => remote);
    const verifier = new JoseLtiTokenVerifier(resolve, clock);
    const token = await platform.launchToken({
      clientId: 'client-1',
      subject: 'teacher-1',
      role: 'teacher',
      nonce: 'nonce-1',
    });
    const check = { issuer: 'http://localhost:3100/test-lms', audience: 'client-1' };

    expect((await verifier.verify(token, { ...check, jwksUrl: platform.jwksUrl })).ok).toBe(true);
    expect(resolve('https://lms.example.edu/jwks')).toBe(remote);
  });

  it('signs a student’s launch with the learner role', async () => {
    const claims = decodeJwt(
      await platform.launchToken({
        clientId: 'client-1',
        subject: 'student-1',
        role: 'learner',
        nonce: 'nonce-1',
      }),
    );
    expect(claims[ltiClaim.roles]).toEqual([
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    ]);
    expect(claims[ltiClaim.roles]).not.toContain(ltiRoles.instructor);
  });

  it('signs a teacher’s deep linking request that the domain accepts', async () => {
    const token = await platform.launchToken({
      clientId: 'client-1',
      subject: 'teacher-1',
      role: 'teacher',
      nonce: 'nonce-1',
      deepLinking: {
        returnUrl: 'http://localhost:3100/api/test-lms/deep-link-return?client=client-1',
        data: 'test-lms-data',
      },
    });

    const launch = checkLaunch(decodeJwt(token), {
      platform: registered,
      expectedNonce: 'nonce-1',
      now: clock.now(),
    });
    expect(launch.ok && launch.value).toMatchObject({
      kind: 'deepLinking',
      resourceLinkId: null,
      deepLinking: {
        returnUrl: 'http://localhost:3100/api/test-lms/deep-link-return?client=client-1',
        acceptMultiple: true,
        data: 'test-lms-data',
      },
    });
  });

  it('launches a placed item with the custom parameters it was placed with', async () => {
    const token = await platform.launchToken({
      clientId: 'client-1',
      subject: 'teacher-1',
      role: 'teacher',
      nonce: 'nonce-1',
      custom: { thp_kind: 'game', thp_id: 'game-1' },
    });

    expect(decodeJwt(token)[ltiClaim.custom]).toEqual({ thp_kind: 'game', thp_id: 'game-1' });
  });

  describe('reading the tool’s deep linking response', () => {
    const tool = new LocalLtiPlatform({ issuer: 'tool', jwksUrl: 'tool-jwks', clock });
    const other = new LocalLtiPlatform({ issuer: 'other', jwksUrl: 'other-jwks', clock });
    const response = (overrides: Record<string, unknown> = {}) => ({
      ...deepLinkingResponse({
        platform: registered,
        deploymentId: LocalLtiPlatform.deploymentId,
        data: 'test-lms-data',
        items: [{ title: 'Planets', item: { kind: 'game', id: 'game-1' as GameId } }],
        launchUrl: 'http://localhost:3100/api/lti/launch',
        nonce: 'nonce-9',
        now: clock.now(),
      }),
      ...overrides,
    });
    const read = async (claims: Record<string, unknown>, signer = tool) =>
      platform.readDeepLinkingResponse(await signer.sign(claims), await tool.publicKeySet(), {
        clientId: 'client-1',
        data: 'test-lms-data',
      });

    it('keeps the placed links of a response the tool signed for it', async () => {
      expect(await read(response())).toEqual([
        { title: 'Planets', custom: { thp_kind: 'game', thp_id: 'game-1' } },
      ]);
    });

    it('refuses a response signed by another key, for another course system or client, or stale', async () => {
      expect(await read(response(), other)).toBeNull();
      expect(await read(response({ aud: 'https://lms.example.edu' }))).toBeNull();
      expect(await read(response({ iss: 'client-2' }))).toBeNull();
      expect(await read(response({ [ltiClaim.messageType]: 'LtiResourceLinkRequest' }))).toBeNull();
      expect(await read(response({ [ltiClaim.deepLinkingData]: 'forged' }))).toBeNull();
      expect(await read(response({ exp: clock.now().getTime() / 1000 - 1 }))).toBeNull();
      expect(
        await platform.readDeepLinkingResponse('not a token', await tool.publicKeySet(), {
          clientId: 'client-1',
          data: 'test-lms-data',
        }),
      ).toBeNull();
    });

    it('leaves out items that are not links with a title', async () => {
      const items = [
        { type: 'ltiResourceLink', title: 'Planets', custom: { thp_kind: 'game', thp_id: 'g' } },
        { type: 'file', title: 'Notes' },
        { type: 'ltiResourceLink', custom: {} },
        { type: 'ltiResourceLink', title: 'No custom' },
        'junk',
      ];
      expect(await read(response({ [ltiClaim.contentItems]: items }))).toEqual([
        { title: 'Planets', custom: { thp_kind: 'game', thp_id: 'g' } },
        { title: 'No custom', custom: {} },
      ]);
      expect(await read(response({ [ltiClaim.contentItems]: 'none' }))).toEqual([]);
    });
  });
});
