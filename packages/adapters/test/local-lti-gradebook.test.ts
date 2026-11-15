import { decodeJwt } from 'jose';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { checkLaunch, type LtiPlatformId, type SchoolId } from '@thp/domain';
import { anLtiPlatform, FixedClock, SequentialTokenGenerator } from '@thp/testing';
import { HttpLtiGradesClient } from '../src/lti/http-lti-grades-client.ts';
import { LocalLtiPlatform } from '../src/lti/local-lti-platform.ts';
import { TestToolKeys } from './tool-keys.ts';

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

const appUrl = 'http://localhost:3100';
const clock = new FixedClock(new Date('2026-11-14T12:00:00Z'));
const lineItemsUrl = `${appUrl}/api/test-lms/lineitems`;
const tokenUrl = `${appUrl}/api/test-lms/token`;
const lineItemScope = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';
const scoreScope = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';

const makeLms = () =>
  new LocalLtiPlatform({
    issuer: `${appUrl}/test-lms`,
    jwksUrl: `${appUrl}/api/test-lms/jwks`,
    tokenUrl,
    membershipsUrl: `${appUrl}/api/test-lms/memberships`,
    lineItemsUrl,
    clock,
  });
const toolKeys = new TestToolKeys();

/** A token for the gradebook, granted to `client` for these scopes. */
async function bearer(lms: LocalLtiPlatform, scope: string, client = 'client-1') {
  const seconds = clock.now().getTime() / 1000;
  const assertion = await toolKeys.sign({
    iss: client,
    sub: client,
    aud: tokenUrl,
    iat: seconds,
    exp: seconds + 300,
    jti: 'j-1',
  });
  const token = await lms.grantServiceToken(
    {
      grantType: 'client_credentials',
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      clientAssertion: assertion,
      scope,
    },
    await toolKeys.publicKeySet(),
  );
  return `Bearer ${token ?? ''}`;
}

const score = (userId: string, scoreGiven: number, timestamp = '2026-11-14T12:00:00.000Z') => ({
  userId,
  scoreGiven,
  scoreMaximum: 10,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
  timestamp,
});

describe('LocalLtiPlatform gradebook', () => {
  it('offers its gradebook, to add columns and post scores, in its launches', async () => {
    const lms = makeLms();
    const token = await lms.launchToken({
      clientId: 'client-1',
      subject: 'student-1',
      role: 'learner',
      nonce: 'nonce-1',
    });
    const launch = checkLaunch(decodeJwt(token), {
      platform: {
        ...anLtiPlatform({ issuer: lms.issuer, clientId: 'client-1' }),
        id: 'p' as LtiPlatformId,
        schoolId: 's' as SchoolId,
        deploymentIds: [LocalLtiPlatform.deploymentId],
      },
      expectedNonce: 'nonce-1',
      now: clock.now(),
    });

    expect(launch.ok && launch.value.gradeService).toEqual({
      lineItemsUrl,
      lineItemUrl: null,
      scopes: [lineItemScope, scoreScope],
    });
  });

  it('keeps columns and scores per tool client, and only with a token for the right scope', async () => {
    const lms = makeLms();
    const book = lms.gradebook;
    if (book === null) throw new Error('no gradebook');
    const both = await bearer(lms, `${lineItemScope} ${scoreScope}`);

    const made = await book.createLineItem(both, {
      label: 'Space quiz',
      resourceId: 'quiz',
      scoreMaximum: 10,
      tag: 'teacherhubpro',
    });
    expect(made.status).toBe(201);
    expect(await book.postScore(both, '1', score('student-1', 7))).toEqual({
      status: 204,
      body: null,
    });
    // An older score never replaces a newer one; a newer one does.
    await book.postScore(both, '1', score('student-1', 3, '2026-11-14T11:00:00.000Z'));
    await book.postScore(both, '1', score('student-2', 9));

    expect(book.view('client-1')).toEqual({
      lineItems: [
        {
          id: `${lineItemsUrl}/1`,
          label: 'Space quiz',
          resourceId: 'quiz',
          scoreMaximum: 10,
          tag: 'teacherhubpro',
          scores: [
            {
              userId: 'student-1',
              scoreGiven: 7,
              scoreMaximum: 10,
              timestamp: score('', 0).timestamp,
            },
            {
              userId: 'student-2',
              scoreGiven: 9,
              scoreMaximum: 10,
              timestamp: score('', 0).timestamp,
            },
          ],
        },
      ],
    });
    expect(book.view('client-2')).toEqual({ lineItems: [] });
    expect((await book.listLineItems(both, 'quiz')).body).toHaveLength(1);
    expect((await book.listLineItems(both, 'other')).body).toEqual([]);

    const otherClient = await bearer(lms, `${lineItemScope} ${scoreScope}`, 'client-2');
    expect((await book.postScore(otherClient, '1', score('student-1', 1))).status).toBe(404);
    const membershipsOnly = await bearer(
      lms,
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    );
    expect((await book.listLineItems(membershipsOnly, null)).status).toBe(401);
    expect((await book.postScore(membershipsOnly, '1', score('student-1', 1))).status).toBe(401);
    expect((await book.listLineItems(null, null)).status).toBe(401);
    expect((await book.createLineItem(both, { label: '' })).status).toBe(400);
    expect((await book.postScore(both, '1', { userId: 'student-1' })).status).toBe(400);
  });

  it('works end to end with the grades client', async () => {
    const lms = makeLms();
    const book = lms.gradebook;
    if (book === null) throw new Error('no gradebook');
    const keys = await toolKeys.publicKeySet();
    server.use(
      http.post(tokenUrl, async ({ request }) => {
        const form = new URLSearchParams(await request.text());
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
      http.get(lineItemsUrl, async ({ request }) => {
        const answer = await book.listLineItems(
          request.headers.get('authorization'),
          new URL(request.url).searchParams.get('resource_id'),
        );
        return new HttpResponse(JSON.stringify(answer.body), {
          status: answer.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
      http.post(lineItemsUrl, async ({ request }) => {
        const answer = await book.createLineItem(
          request.headers.get('authorization'),
          await request.json(),
        );
        return new HttpResponse(JSON.stringify(answer.body), {
          status: answer.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
      http.post(`${lineItemsUrl}/:item/scores`, async ({ request, params }) => {
        const answer = await book.postScore(
          request.headers.get('authorization'),
          String(params.item),
          await request.json(),
        );
        return new HttpResponse(null, { status: answer.status });
      }),
    );
    const client = new HttpLtiGradesClient({
      signer: toolKeys,
      clock,
      tokens: new SequentialTokenGenerator(),
    });
    const platform = anLtiPlatform({
      issuer: lms.issuer,
      clientId: 'client-1',
      authTokenUrl: tokenUrl,
    });
    const request = {
      lineItemsUrl,
      lineItem: { scoreMaximum: 10, label: 'Space quiz', resourceId: 'quiz', tag: 'teacherhubpro' },
      scores: [
        {
          userId: 'student-1',
          scoreGiven: 8,
          scoreMaximum: 10,
          activityProgress: 'Completed' as const,
          gradingProgress: 'FullyGraded' as const,
          timestamp: '2026-11-14T12:00:00.000Z',
        },
      ],
    };

    expect(await client.sendScores(platform, request)).toEqual({
      ok: true,
      value: { sent: 1, failed: 0 },
    });
    expect(await client.sendScores(platform, request)).toEqual({
      ok: true,
      value: { sent: 1, failed: 0 },
    });
    const view = book.view('client-1');
    expect(view.lineItems).toHaveLength(1);
    expect(view.lineItems[0]?.scores).toEqual([
      {
        userId: 'student-1',
        scoreGiven: 8,
        scoreMaximum: 10,
        timestamp: '2026-11-14T12:00:00.000Z',
      },
    ]);
  });
});
