import { describe, expect, it } from 'vitest';
import { teamsContract } from '@thp/testing';
import { TeamsGraph } from '../src/microsoft/teams-graph.ts';

// Recorded responses: the shapes Microsoft Learn documents for the Graph v1.0 education API
// (List classes of an educationUser, List members / teachers of an educationClass, Create
// educationAssignment, setUpResourcesFolder, Upload files for education assignments, Create
// educationAssignmentResource, publish, Delete educationAssignment). Nothing calls Microsoft.

const graph = 'https://graph.microsoft.com/v1.0';
const urlOf = (input: string | URL | Request) =>
  input instanceof Request ? input.url : input.toString();
const classId = '72a7baec-c3e9-4213-a850-f62de0adad5f';
const driveId = 'b!6SQl0y4WHkS2P5MeIsSGpKwfynEIaD1OvPVeH4wbOp_1uyhNwJMSSpseJneB7Z4F';
const folderUrl = `${graph}/drives/${driveId}/items/01YT2AIJRQLVYT24IWWFAJHMRRNYCB3GFA`;
const teamsToken = 'graph-teams';
const oneDriveToken = 'graph-onedrive';
const webUrl = (assignmentId: string) =>
  `https://teams.microsoft.com/l/entity/66aeee93-507d-479a-a3ef-8f494af43945/classroom?context=${encodeURIComponent(
    JSON.stringify({ subEntityId: { classId, assignmentId } }),
  )}`;

interface Sent {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

const member = (id: string, givenName: string | null, surname: string | null, role: string) => ({
  id,
  accountEnabled: true,
  displayName: [givenName, surname].filter(Boolean).join(' '),
  givenName,
  surname,
  userPrincipalName: `${id}@contoso.com`,
  userType: 'Member',
  primaryRole: role,
  onPremisesInfo: { immutableId: null },
  [role]: {},
});

const members = [
  member('87d349ed', 'Adele', 'Vance', 'teacher'),
  member('b66ecf79', 'Christie', 'Cline', 'student'),
  member('f5289423', 'Ben', 'Walters', 'student'),
];

/** A fake Graph for one teacher and one class, answering as the documentation shows. */
function educationApi(
  options: { failAt?: { method: string; path: RegExp; status: number }; pages?: boolean } = {},
) {
  const sent: Sent[] = [];
  let assignments = 0;
  const error = (status: number, code: string) =>
    Response.json(
      { error: { code, message: code, innerError: { 'request-id': 'r-1' } } },
      { status },
    );
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve();
    const url = urlOf(input);
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    sent.push({ method, url, headers, body });
    const auth = headers.get('authorization');
    if (auth === `Bearer ${oneDriveToken}`) return error(403, 'Forbidden');
    if (auth !== `Bearer ${teamsToken}`) return error(401, 'InvalidAuthenticationToken');
    const path = url.replace(graph, '');
    if (options.failAt?.method === method && options.failAt.path.test(path)) {
      return error(options.failAt.status, 'serviceNotAvailable');
    }
    if (method === 'GET' && path === '/education/me/classes?$select=id,displayName') {
      return Response.json({
        value: [{ id: classId, displayName: 'Science 5A' }],
        ...(options.pages
          ? { '@odata.nextLink': `${graph}/education/me/classes?$skiptoken=page-2` }
          : {}),
      });
    }
    if (method === 'GET' && path === '/education/me/classes?$skiptoken=page-2') {
      return Response.json({ value: [{ id: 'second', displayName: null }] });
    }
    const inClass = new RegExp(`^/education/classes/${classId}(/.*)$`, 'u').exec(path);
    if (inClass === null) {
      if (path.startsWith(`/drives/${driveId}/items/`) && method === 'PUT') {
        return Response.json(
          {
            id: '01YT2AIJU7DAXTU6XLOJGYWYMTGM5JT5UQ',
            name: decodeURIComponent(path.split(':/')[1] ?? ''),
            webUrl: 'https://contoso.sharepoint.com/sites/Science5A/Class%20Files/Assignments/x',
            parentReference: { driveId, driveType: 'documentLibrary' },
            file: { mimeType: headers.get('content-type') },
          },
          { status: 201 },
        );
      }
      return error(404, 'itemNotFound');
    }
    const rest = inClass[1] ?? '';
    if (method === 'GET' && rest === '/members?$select=id,givenName,surname,displayName') {
      return Response.json({
        '@odata.context': `${graph}/$metadata#Collection(microsoft.graph.educationUser)`,
        value: members,
      });
    }
    if (method === 'GET' && rest === '/teachers?$select=id') {
      return Response.json({ value: [{ id: '87d349ed' }] });
    }
    if (method === 'POST' && rest === '/assignments') {
      assignments += 1;
      const id = `ea77e1dd-${String(assignments)}`;
      const request = body as Record<string, unknown>;
      return Response.json(
        {
          classId,
          ...request,
          id,
          status: 'draft',
          resourcesFolderUrl: null,
          webUrl: webUrl(id),
          assignedDateTime: null,
        },
        { status: 201 },
      );
    }
    const one = /^\/assignments\/([^/]+)(\/.*)?$/u.exec(rest);
    if (one === null) return error(404, 'itemNotFound');
    const [, id = '', action = ''] = one;
    if (method === 'POST' && action === '/resources') {
      return Response.json(
        { id: 'resource-1', distributeForStudentWork: false, ...(body as object) },
        { status: 201 },
      );
    }
    if (method === 'POST' && action === '/setUpResourcesFolder') {
      return Response.json({ id, classId, status: 'draft', resourcesFolderUrl: folderUrl });
    }
    if (method === 'POST' && action === '/publish') {
      return Response.json({ id, classId, status: 'published', webUrl: webUrl(id) });
    }
    if (method === 'DELETE' && action === '') return new Response(null, { status: 204 });
    return error(404, 'itemNotFound');
  };
  return { fetchFn, sent };
}

teamsContract('TeamsGraph', () => ({
  teams: new TeamsGraph(educationApi().fetchFn),
  accessToken: teamsToken,
  oneDriveOnlyToken: oneDriveToken,
  classId,
  className: 'Science 5A',
  students: [
    { firstName: 'Christie', lastName: 'Cline' },
    { firstName: 'Ben', lastName: 'Walters' },
  ],
}));

const linkRequest = {
  title: 'Space quiz',
  instructions: 'Answer in TeacherHubPro.',
  resource: { kind: 'link', name: 'TeacherHubPro', url: 'https://app.test' },
  dueAt: new Date('2026-10-01T03:59:00Z'),
  assignAt: null,
} as const;

const word = new Uint8Array([0x50, 0x4b, 3, 4]);

describe('TeamsGraph', () => {
  it('asks only for the class ids and names, and follows every page', async () => {
    const api = educationApi({ pages: true });
    expect(await new TeamsGraph(api.fetchFn).listClasses(teamsToken)).toEqual({
      ok: true,
      value: [
        { id: classId, name: 'Science 5A' },
        { id: 'second', name: 'second' },
      ],
    });
    expect(api.sent.map((s) => s.url)).toEqual([
      `${graph}/education/me/classes?$select=id,displayName`,
      `${graph}/education/me/classes?$skiptoken=page-2`,
    ]);
  });

  it('reads only names from the roster, leaves the teachers out, and splits a lone display name', async () => {
    const api = educationApi();
    const graphApi = new TeamsGraph(async (input, init) => {
      const answer = await api.fetchFn(input, init);
      if (!urlOf(input).includes('/members')) return answer;
      return Response.json({
        value: [
          ...members,
          { id: 'x1', givenName: null, surname: null, displayName: 'María de la Cruz' },
          { id: 'x2', givenName: ' Ana ', surname: null, displayName: 'Ana' },
        ],
      });
    });
    expect(await graphApi.listStudents(teamsToken, classId)).toEqual({
      ok: true,
      value: [
        { firstName: 'Christie', lastName: 'Cline' },
        { firstName: 'Ben', lastName: 'Walters' },
        { firstName: 'María de la', lastName: 'Cruz' },
        { firstName: 'Ana', lastName: '' },
      ],
    });
    expect(api.sent.map((s) => s.url)).toEqual([
      `${graph}/education/classes/${classId}/members?$select=id,givenName,surname,displayName`,
      `${graph}/education/classes/${classId}/teachers?$select=id`,
    ]);
  });

  it('creates a draft for the whole class, adds the link, then publishes it', async () => {
    const api = educationApi();
    const posted = await new TeamsGraph(api.fetchFn).createAssignment(
      teamsToken,
      classId,
      linkRequest,
    );
    expect(posted).toEqual({ ok: true, value: { id: 'ea77e1dd-1', url: webUrl('ea77e1dd-1') } });
    const at = `${graph}/education/classes/${classId}/assignments`;
    expect(api.sent.map((s) => [s.method, s.url, s.body])).toEqual([
      [
        'POST',
        at,
        {
          displayName: 'Space quiz',
          instructions: { contentType: 'text', content: 'Answer in TeacherHubPro.' },
          dueDateTime: '2026-10-01T03:59:00.000Z',
          assignTo: { '@odata.type': '#microsoft.graph.educationAssignmentClassRecipient' },
          status: 'draft',
        },
      ],
      [
        'POST',
        `${at}/ea77e1dd-1/resources`,
        {
          distributeForStudentWork: false,
          resource: {
            '@odata.type': '#microsoft.graph.educationLinkResource',
            displayName: 'TeacherHubPro',
            link: 'https://app.test',
          },
        },
      ],
      ['POST', `${at}/ea77e1dd-1/publish`, undefined],
    ]);
    expect(api.sent[0]?.headers.get('content-type')).toBe('application/json');
  });

  it('schedules the assignment with assignDateTime, and sends no due date when there is none', async () => {
    const api = educationApi();
    await new TeamsGraph(api.fetchFn).createAssignment(teamsToken, classId, {
      ...linkRequest,
      dueAt: null,
      assignAt: new Date('2026-09-03T12:00:00Z'),
    });
    expect(api.sent[0]?.body).toMatchObject({ assignDateTime: '2026-09-03T12:00:00.000Z' });
    expect(api.sent[0]?.body).not.toHaveProperty('dueDateTime');
  });

  it('puts a Word document in the resources folder and gives each student a copy', async () => {
    const api = educationApi();
    const posted = await new TeamsGraph(api.fetchFn).createAssignment(teamsToken, classId, {
      ...linkRequest,
      resource: { kind: 'wordCopy', fileName: 'Unit 3: test?.docx', bytes: word },
    });
    expect(posted.ok).toBe(true);
    const at = `${graph}/education/classes/${classId}/assignments/ea77e1dd-1`;
    expect(api.sent.map((s) => [s.method, s.url])).toEqual([
      ['POST', `${graph}/education/classes/${classId}/assignments`],
      ['POST', `${at}/setUpResourcesFolder`],
      ['PUT', `${folderUrl}:/${encodeURIComponent('Unit 3 test.docx')}:/content`],
      ['POST', `${at}/resources`],
      ['POST', `${at}/publish`],
    ]);
    expect(api.sent[1]?.body).toEqual({});
    expect(api.sent[2]?.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(api.sent[2]?.body).toEqual(word);
    expect(api.sent[3]?.body).toEqual({
      distributeForStudentWork: true,
      resource: {
        '@odata.type': '#microsoft.graph.educationWordResource',
        displayName: 'Unit 3 test.docx',
        fileUrl: `${graph}/drives/${driveId}/items/01YT2AIJU7DAXTU6XLOJGYWYMTGM5JT5UQ`,
      },
    });
  });

  it('deletes the draft when its resource or publishing fails, and says why', async () => {
    for (const [method, path, status, code] of [
      ['POST', /\/resources$/u, 503, 'throttled'],
      ['POST', /\/publish$/u, 500, 'unavailable'],
      ['POST', /\/setUpResourcesFolder$/u, 403, 'insufficient_scope'],
      ['PUT', /:\/content$/u, 507, 'unavailable'],
    ] as const) {
      const api = educationApi({ failAt: { method, path, status } });
      const resource =
        method === 'PUT' || path.source.includes('setUp')
          ? ({ kind: 'wordCopy', fileName: 'a.docx', bytes: word } as const)
          : linkRequest.resource;
      expect(
        await new TeamsGraph(api.fetchFn).createAssignment(teamsToken, classId, {
          ...linkRequest,
          resource,
        }),
      ).toEqual({ ok: false, error: { code } });
      expect(api.sent.at(-1)).toMatchObject({
        method: 'DELETE',
        url: `${graph}/education/classes/${classId}/assignments/ea77e1dd-1`,
      });
    }
  });

  it('never sends the token to a resources folder outside Microsoft Graph', async () => {
    const api = educationApi();
    const graphApi = new TeamsGraph(async (input, init) => {
      if (urlOf(input).endsWith('/setUpResourcesFolder')) {
        return Response.json({ resourcesFolderUrl: 'https://evil.test/drives/x/items/y' });
      }
      return api.fetchFn(input, init);
    });
    expect(
      await graphApi.createAssignment(teamsToken, classId, {
        ...linkRequest,
        resource: { kind: 'wordCopy', fileName: 'a.docx', bytes: word },
      }),
    ).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(api.sent.some((s) => s.url.startsWith('https://evil.test'))).toBe(false);
  });

  it('never follows a next page outside Microsoft Graph', async () => {
    const graphApi = new TeamsGraph(async () => {
      await Promise.resolve();
      return Response.json({ value: [], '@odata.nextLink': 'https://evil.test/next' });
    });
    expect(await graphApi.listClasses(teamsToken)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });

  it('tells expired access, a missing permission, a busy or unreachable Graph and odd answers apart', async () => {
    const respond = (status: number, body: object) => async () => {
      await Promise.resolve();
      return Response.json(body, { status });
    };
    for (const [fetchFn, code] of [
      [respond(401, { error: { code: 'InvalidAuthenticationToken' } }), 'unauthorized'],
      [respond(403, { error: { code: 'Forbidden' } }), 'insufficient_scope'],
      [respond(404, { error: { code: 'itemNotFound' } }), 'not_found'],
      [respond(429, { error: { code: 'tooManyRequests' } }), 'throttled'],
      [respond(503, { error: { code: 'serviceNotAvailable' } }), 'throttled'],
      [respond(500, { error: { code: 'generalException' } }), 'unavailable'],
      [respond(200, { classes: [] }), 'unavailable'],
      [() => Promise.reject(new Error('down')), 'unavailable'],
    ] as const) {
      expect(await new TeamsGraph(fetchFn).listClasses(teamsToken)).toEqual({
        ok: false,
        error: { code },
      });
    }
    expect(
      await new TeamsGraph(respond(201, { id: 'a-1', webUrl: null })).createAssignment(
        teamsToken,
        classId,
        linkRequest,
      ),
    ).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
