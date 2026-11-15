import { decodeJwt } from 'jose';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LtiScore } from '@thp/domain';
import {
  anLtiPlatform,
  FakeToolKeyStore,
  FixedClock,
  ltiGradesClientContract,
  SequentialTokenGenerator,
} from '@thp/testing';
import { HttpLtiGradesClient } from '../src/lti/http-lti-grades-client.ts';

// Recorded shapes: the IMS LTI Assignment and Grade Services 2.0 line item container, line item
// and score, and the OAuth 2 client credentials grant, as Canvas and Moodle answer them. Nothing
// calls a real course system.

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
const lineItemsUrl = 'https://lms.example.edu/api/lti/courses/9/line_items';
const clock = new FixedClock(new Date('2026-11-14T12:00:00Z'));
const containerType = 'application/vnd.ims.lis.v2.lineitemcontainer+json';
const lineItemType = 'application/vnd.ims.lis.v2.lineitem+json';
const scoreType = 'application/vnd.ims.lis.v1.score+json';
const scopes = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
];

const client = () =>
  new HttpLtiGradesClient({
    signer: new FakeToolKeyStore(),
    clock,
    tokens: new SequentialTokenGenerator(),
  });

const lineItem = {
  scoreMaximum: 10,
  label: 'Space quiz',
  resourceId: 'quiz',
  tag: 'teacherhubpro',
};
const score = (userId: string, scoreGiven = 9): LtiScore => ({
  userId,
  scoreGiven,
  scoreMaximum: 10,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
  timestamp: '2026-11-14T12:00:00.000Z',
});

interface Recorded {
  form?: URLSearchParams;
  listUrls: string[];
  created: unknown[];
  createdType?: string | null;
  scoreTypes: (string | null)[];
}

interface Column {
  id: string;
  resourceId: string;
  scoreMaximum: number;
  label: string;
}

/**
 * A course gradebook: a token endpoint granting `bearer-1`, line items that want it, and scores
 * kept per user. `refusal` refuses the token (401) or fails it (500).
 */
function gradebook(options: { refusal?: 'not_allowed' | 'unavailable'; columns?: Column[] } = {}) {
  const columns: Column[] = options.columns ?? [];
  const scores = new Map<string, Map<string, LtiScore>>();
  const recorded: Recorded = { listUrls: [], created: [], scoreTypes: [] };
  const authorized = (request: Request) =>
    request.headers.get('authorization') === 'Bearer bearer-1';
  server.use(
    http.post(platform.authTokenUrl, async ({ request }) => {
      recorded.form = new URLSearchParams(await request.text());
      if (options.refusal !== undefined) {
        return HttpResponse.json(
          { error: 'invalid_client' },
          { status: options.refusal === 'not_allowed' ? 401 : 500 },
        );
      }
      return HttpResponse.json({
        access_token: 'bearer-1',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: scopes.join(' '),
      });
    }),
    http.get(lineItemsUrl, ({ request }) => {
      if (!authorized(request)) return new HttpResponse(null, { status: 401 });
      recorded.listUrls.push(request.url);
      const wanted = new URL(request.url).searchParams.get('resource_id');
      const listed = columns.filter((c) => wanted === null || c.resourceId === wanted);
      return HttpResponse.json(listed, { headers: { 'Content-Type': containerType } });
    }),
    http.post(lineItemsUrl, async ({ request }) => {
      if (!authorized(request)) return new HttpResponse(null, { status: 401 });
      const body = (await request.json()) as Omit<Column, 'id'>;
      recorded.created.push(body);
      recorded.createdType = request.headers.get('content-type');
      const column = { ...body, id: `${lineItemsUrl}/${String(columns.length + 1)}` };
      columns.push(column);
      return HttpResponse.json(column, { status: 201, headers: { 'Content-Type': lineItemType } });
    }),
    http.post(`${lineItemsUrl}/:column/scores`, async ({ request, params }) => {
      if (!authorized(request)) return new HttpResponse(null, { status: 401 });
      recorded.scoreTypes.push(request.headers.get('content-type'));
      const column = `${lineItemsUrl}/${String(params.column)}`;
      const sent = (await request.json()) as LtiScore;
      const book = scores.get(column) ?? new Map<string, LtiScore>();
      book.set(sent.userId, sent);
      scores.set(column, book);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return {
    recorded,
    columns,
    state: () => ({
      lineItems: columns.map(({ resourceId, scoreMaximum }) => ({ resourceId, scoreMaximum })),
      scores: [...scores.values()].flatMap((book) => [...book.values()]),
    }),
  };
}

ltiGradesClientContract('HttpLtiGradesClient', (setup) => {
  const book = gradebook(setup.refusal === undefined ? {} : { refusal: setup.refusal });
  return {
    client: client(),
    platform,
    lineItemsUrl,
    gradebook: () => Promise.resolve(book.state()),
  };
});

describe('HttpLtiGradesClient', () => {
  it('asks for a gradebook token with a client assertion signed by the tool', async () => {
    const { recorded } = gradebook();

    await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] });

    expect(Object.fromEntries(recorded.form ?? [])).toMatchObject({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      scope: scopes.join(' '),
    });
    expect(decodeJwt(recorded.form?.get('client_assertion') ?? '')).toMatchObject({
      iss: platform.clientId,
      sub: platform.clientId,
      aud: platform.authTokenUrl,
    });
  });

  it('looks the column up by the assignment’s id, then makes it with the line item type', async () => {
    const { recorded } = gradebook();

    await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] });

    expect(recorded.listUrls).toEqual([`${lineItemsUrl}?resource_id=quiz`]);
    expect(recorded.created).toEqual([lineItem]);
    expect(recorded.createdType).toBe(lineItemType);
    expect(recorded.scoreTypes).toEqual([scoreType]);
  });

  it('uses the column already there, even when the course system ignores the filter', async () => {
    const existing = {
      id: `${lineItemsUrl}/7`,
      resourceId: 'quiz',
      scoreMaximum: 10,
      label: 'Space quiz',
    };
    const other = { ...existing, id: `${lineItemsUrl}/6`, resourceId: 'other' };
    const { recorded } = gradebook({ columns: [existing] });
    server.use(http.get(lineItemsUrl, () => HttpResponse.json([other, existing])));

    const sent = await client().sendScores(platform, {
      lineItemsUrl,
      lineItem,
      scores: [score('lms-1')],
    });

    expect(sent).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
    expect(recorded.created).toEqual([]);
  });

  it('reads further pages of columns, only on the gradebook’s own site', async () => {
    const { recorded } = gradebook();
    const page2 = `${lineItemsUrl}?resource_id=quiz&page=2`;
    server.use(
      http.get(lineItemsUrl, ({ request }) => {
        if (request.url === page2) {
          return HttpResponse.json([
            { id: `${lineItemsUrl}/3`, resourceId: 'quiz', scoreMaximum: 10 },
          ]);
        }
        return HttpResponse.json([], { headers: { Link: `<${page2}>; rel="next"` } });
      }),
      http.post(`${lineItemsUrl}/3/scores`, () => new HttpResponse(null, { status: 200 })),
    );

    const sent = await client().sendScores(platform, {
      lineItemsUrl,
      lineItem,
      scores: [score('lms-1')],
    });

    expect(sent).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
    expect(recorded.created).toEqual([]);

    server.use(
      http.get(lineItemsUrl, () =>
        HttpResponse.json([], { headers: { Link: '<https://evil.example/items>; rel="next"' } }),
      ),
    );
    await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] });
    expect(recorded.created).toEqual([lineItem]);
  });

  it('keeps a column address’s query when posting its scores (as Moodle’s have)', async () => {
    gradebook();
    const moodleItem =
      'https://lms.example.edu/mod/lti/services.php/2/lineitems/5/lineitem?type_id=1';
    let posted: string | null = null;
    server.use(
      http.get(lineItemsUrl, () =>
        HttpResponse.json([{ id: moodleItem, resourceId: 'quiz', scoreMaximum: 10 }]),
      ),
      http.post(
        'https://lms.example.edu/mod/lti/services.php/2/lineitems/5/lineitem/scores',
        ({ request }) => {
          posted = request.url;
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] });

    expect(posted).toBe(
      'https://lms.example.edu/mod/lti/services.php/2/lineitems/5/lineitem/scores?type_id=1',
    );
  });

  it('counts a score the course system refuses, and sends the others', async () => {
    gradebook({
      columns: [{ id: `${lineItemsUrl}/1`, resourceId: 'quiz', scoreMaximum: 10, label: 'Q' }],
    });
    server.use(
      http.post(`${lineItemsUrl}/1/scores`, async ({ request }) => {
        const sent = (await request.json()) as LtiScore;
        return new HttpResponse(null, { status: sent.userId === 'left-course' ? 422 : 204 });
      }),
    );

    expect(
      await client().sendScores(platform, {
        lineItemsUrl,
        lineItem,
        scores: [score('lms-1'), score('left-course'), score('lms-2')],
      }),
    ).toEqual({ ok: true, value: { sent: 2, failed: 1 } });
  });

  it('tries a score once more when the course system is briefly unavailable', async () => {
    gradebook({
      columns: [{ id: `${lineItemsUrl}/1`, resourceId: 'quiz', scoreMaximum: 10, label: 'Q' }],
    });
    let attempts = 0;
    server.use(
      http.post(`${lineItemsUrl}/1/scores`, () => {
        attempts += 1;
        return new HttpResponse(null, { status: attempts === 1 ? 503 : 204 });
      }),
    );

    expect(
      await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] }),
    ).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
    expect(attempts).toBe(2);
  });

  it.each([
    ['a refused column list', () => new HttpResponse(null, { status: 403 }), 'not_allowed'],
    ['a failing column list', () => new HttpResponse(null, { status: 500 }), 'unavailable'],
    ['a column list that is not a list', () => HttpResponse.json({ items: [] }), 'unavailable'],
    ['a network failure', () => HttpResponse.error(), 'unavailable'],
  ] as const)('reports %s', async (_case, answer, error) => {
    gradebook();
    server.use(http.get(lineItemsUrl, answer));

    expect(
      await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] }),
    ).toEqual({ ok: false, error });
  });

  it('refuses a new column the course system says is on another site', async () => {
    gradebook();
    server.use(
      http.post(lineItemsUrl, () =>
        HttpResponse.json({ id: 'https://evil.example/items/1', ...lineItem }, { status: 201 }),
      ),
    );

    expect(
      await client().sendScores(platform, { lineItemsUrl, lineItem, scores: [score('lms-1')] }),
    ).toEqual({ ok: false, error: 'unavailable' });
  });
});
