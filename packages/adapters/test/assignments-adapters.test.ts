import { randomBytes } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  classroomAuthorizationContract,
  classroomContract,
  googleDriveContract,
  googleFormsContract,
  pdfTextExtractorContract,
  secretCipherContract,
} from '@thp/testing';
import { AesGcmCipher } from '../src/crypto/aes-gcm-cipher.ts';
import { GoogleClassroom } from '../src/google/google-classroom.ts';
import { GoogleClassroomAuthorization } from '../src/google/google-classroom-authorization.ts';
import { GoogleDriveApi } from '../src/google/google-drive.ts';
import { GoogleFormsApi } from '../src/google/google-forms.ts';
import { LocalDrive } from '../src/google/local-drive.ts';
import { LocalForms } from '../src/google/local-forms.ts';
import {
  LocalClassroom,
  LocalClassroomAuthorization,
  localClassroomFixture,
} from '../src/google/local-classroom.ts';
import { UnpdfTextExtractor } from '../src/pdf/unpdf-text-extractor.ts';

async function makePdf(pages: readonly string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage([400, 200]);
    if (text !== '') page.drawText(text, { x: 20, y: 150, size: 14, font });
  }
  return doc.save();
}

const quiz = await makePdf(['Quiz text', '']);

pdfTextExtractorContract('UnpdfTextExtractor', () => new UnpdfTextExtractor(), {
  pdf: quiz,
  text: 'Quiz text',
  pageCount: 2,
});

describe('UnpdfTextExtractor', () => {
  it('reads every page in order', async () => {
    const pdf = await makePdf(['First page', 'Second page']);
    const result = await new UnpdfTextExtractor().extract(pdf);
    expect(result.ok && result.value.text).toBe('First page\nSecond page');
  });

  it('gives empty text for a PDF without text, such as a scan', async () => {
    const result = await new UnpdfTextExtractor().extract(await makePdf(['']));
    expect(result).toEqual({ ok: true, value: { text: '', pageCount: 1 } });
  });

  it('refuses a PDF over the size limit before opening it', async () => {
    const result = await new UnpdfTextExtractor({ maxBytes: 10 }).extract(quiz);
    expect(result).toEqual({ ok: false, error: { code: 'too_large' } });
  });
});

const key = randomBytes(32).toString('base64');
secretCipherContract('AesGcmCipher', () => new AesGcmCipher(key));

describe('AesGcmCipher', () => {
  it('needs a 32-byte key and cannot open another key’s secrets', async () => {
    expect(() => new AesGcmCipher('short')).toThrow('TOKEN_ENCRYPTION_KEY');
    const sealed = await new AesGcmCipher(key).encrypt('secret');
    const other = new AesGcmCipher(randomBytes(32).toString('base64'));
    expect(await other.decrypt(sealed)).toEqual({ ok: false, error: { code: 'invalid' } });
  });
});

/** Google Classroom's REST API, answering like the recorded real responses. */
function classroomApi(accessToken: string) {
  const posted: unknown[] = [];
  const answer = (input: string | URL | Request, init?: RequestInit): Response => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const auth = new Headers(init?.headers).get('authorization');
    if (auth !== `Bearer ${accessToken}`) {
      return Response.json({ error: { code: 401, status: 'UNAUTHENTICATED' } }, { status: 401 });
    }
    if (url.pathname === '/v1/courses') {
      return Response.json({
        courses: [{ id: 'c-1', name: 'Science 5', section: 'A', courseState: 'ACTIVE' }],
      });
    }
    if (url.pathname === '/v1/courses/c-1/students') {
      return Response.json({
        students: [
          {
            userId: 'u1',
            profile: { name: { givenName: 'Ana', familyName: 'Zayas', fullName: 'Ana Zayas' } },
          },
          {
            userId: 'u2',
            profile: { name: { givenName: 'Ben', familyName: 'Acosta', fullName: 'Ben Acosta' } },
          },
        ],
      });
    }
    if (url.pathname === '/v1/courses/c-1/courseWork' && init?.method === 'POST') {
      posted.push(JSON.parse(typeof init.body === 'string' ? init.body : '{}'));
      return Response.json({
        id: 'cw-1',
        alternateLink: 'https://classroom.google.com/c/c-1/a/cw-1',
      });
    }
    return Response.json({ error: { code: 404, status: 'NOT_FOUND' } }, { status: 404 });
  };
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
    Promise.resolve(answer(input, init));
  return { fetchFn, posted };
}

const fixture = {
  accessToken: 'ya29.recorded',
  course: { id: 'c-1', name: 'Science 5', section: 'A' },
  roster: [
    { firstName: 'Ana', lastName: 'Zayas' },
    { firstName: 'Ben', lastName: 'Acosta' },
  ],
};

classroomContract(
  'GoogleClassroom',
  (f) => new GoogleClassroom(classroomApi(f.accessToken).fetchFn),
  fixture,
);
classroomContract('LocalClassroom', () => new LocalClassroom(), localClassroomFixture);

describe('GoogleClassroom', () => {
  it('posts coursework with the link and due date, as published', async () => {
    const api = classroomApi(fixture.accessToken);
    await new GoogleClassroom(api.fetchFn).createCoursework(fixture.accessToken, 'c-1', {
      title: 'Quiz',
      description: 'Use your personal link.',
      material: { kind: 'link', url: 'https://app.test' },
      dueDate: '2026-09-30' as never,
    });
    expect(api.posted[0]).toEqual({
      title: 'Quiz',
      description: 'Use your personal link.',
      materials: [{ link: { url: 'https://app.test' } }],
      workType: 'ASSIGNMENT',
      state: 'PUBLISHED',
      dueDate: { year: 2026, month: 9, day: 30 },
      dueTime: { hours: 23, minutes: 59 },
    });
  });

  it('posts a scheduled coursework as a draft that Classroom publishes at that time', async () => {
    const api = classroomApi(fixture.accessToken);
    await new GoogleClassroom(api.fetchFn).createCoursework(fixture.accessToken, 'c-1', {
      title: 'Slides',
      description: '',
      material: { kind: 'link', url: 'https://app.test' },
      dueDate: null,
      scheduledAt: new Date('2026-11-10T12:30:00Z'),
    });
    expect(api.posted[0]).toMatchObject({
      state: 'DRAFT',
      scheduledTime: '2026-11-10T12:30:00.000Z',
    });
  });

  it('reports a server error as unavailable', async () => {
    const failing = () => Promise.resolve(new Response('{}', { status: 503 }));
    expect(await new GoogleClassroom(failing).listCourses('t')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});

/** Google's OAuth token endpoint, answering like the recorded real responses. */
function tokenEndpoint(knownCode: string) {
  return (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const form = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    if (form.get('grant_type') === 'authorization_code' && form.get('code') === knownCode) {
      return Promise.resolve(
        Response.json({ access_token: 'ya29.a', refresh_token: '1//refresh', expires_in: 3599 }),
      );
    }
    if (form.get('grant_type') === 'refresh_token' && form.get('refresh_token') === '1//refresh') {
      return Promise.resolve(Response.json({ access_token: 'ya29.b', expires_in: 3599 }));
    }
    return Promise.resolve(Response.json({ error: 'invalid_grant' }, { status: 400 }));
  };
}

const credentials = { clientId: 'client-1', clientSecret: 'secret-1' };

classroomAuthorizationContract('GoogleClassroomAuthorization', () => ({
  authorization: new GoogleClassroomAuthorization(credentials, tokenEndpoint('good-code')),
  code: 'good-code',
}));
classroomAuthorizationContract('LocalClassroomAuthorization', () => ({
  authorization: new LocalClassroomAuthorization(),
  code: 'local-classroom-code',
}));

describe('GoogleClassroomAuthorization', () => {
  it('asks for offline access with only the Classroom and Forms scopes it needs', () => {
    const url = new URL(
      new GoogleClassroomAuthorization(credentials, tokenEndpoint('x')).authorizationUrl(
        's',
        'https://app.test/cb',
      ),
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    // The account chooser lets a teacher connect the Google account they teach with.
    expect(url.searchParams.get('prompt')).toBe('select_account consent');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students',
      'https://www.googleapis.com/auth/drive.file',
    ]);
  });

  it('treats a code exchange without a refresh token, or an unreachable Google, as a failure', async () => {
    const noRefresh = () => Promise.resolve(Response.json({ access_token: 'only' }));
    expect(
      await new GoogleClassroomAuthorization(credentials, noRefresh).exchangeCode(
        'c',
        'https://app.test/cb',
      ),
    ).toEqual({ ok: false, error: { code: 'unauthorized' } });
    const down = () => Promise.reject(new Error('network'));
    expect(await new GoogleClassroomAuthorization(credentials, down).accessToken('r')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });

  it('sends the local stand-in straight back to the app with its code', () => {
    const url = new URL(
      new LocalClassroomAuthorization().authorizationUrl('s-1', 'https://app.test/cb'),
    );
    expect(url.origin + url.pathname).toBe('https://app.test/cb');
    expect(url.searchParams.get('code')).toBe('local-classroom-code');
  });
});

/** Google Forms' REST API, answering like the recorded real responses. */
function formsApi(accessToken: string, status = 200) {
  const calls: { path: string; body: unknown }[] = [];
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
    calls.push({ path: url.pathname, body });
    if (new Headers(init?.headers).get('authorization') !== `Bearer ${accessToken}`) {
      return Promise.resolve(Response.json({ error: { code: 401 } }, { status: 401 }));
    }
    if (status !== 200) return Promise.resolve(Response.json({ error: {} }, { status }));
    if (url.pathname === '/v1/forms' && init?.method === 'POST') {
      return Promise.resolve(
        Response.json({
          formId: 'f-1',
          info: { title: 'Fractions quiz', documentTitle: 'Fractions quiz' },
          responderUri: 'https://docs.google.com/forms/d/e/1FAIp-f-1/viewform',
        }),
      );
    }
    if (url.pathname === '/v1/forms/f-1:batchUpdate' && init?.method === 'POST') {
      return Promise.resolve(Response.json({ replies: [] }));
    }
    return Promise.resolve(Response.json({ error: { code: 404 } }, { status: 404 }));
  };
  return { fetchFn, calls };
}

googleFormsContract(
  'GoogleFormsApi',
  (token) => new GoogleFormsApi(formsApi(token).fetchFn),
  'ya29.recorded',
);
googleFormsContract('LocalForms', () => new LocalForms(), localClassroomFixture.accessToken);

describe('GoogleFormsApi', () => {
  const quiz = {
    title: 'Fractions quiz',
    description: 'Show your work.',
    items: [
      {
        kind: 'choice' as const,
        title: '1/2 + 1/4?',
        description: 'Simplify.',
        points: 5,
        options: ['3/4', '2/6'],
        correct: ['3/4'],
      },
      {
        kind: 'text' as const,
        title: 'Half of 8',
        description: null,
        points: 2,
        paragraph: false,
        correct: ['4'],
      },
      {
        kind: 'text' as const,
        title: 'Explain',
        description: null,
        points: 10,
        paragraph: true,
        correct: [],
      },
      {
        kind: 'grid' as const,
        title: 'Match',
        description: null,
        rows: ['1/2', '1/4'],
        columns: ['half', 'quarter'],
      },
    ],
  };

  it('creates the form, then makes it a quiz with every question in order', async () => {
    const api = formsApi('t');
    const result = await new GoogleFormsApi(api.fetchFn).createQuiz('t', quiz);

    expect(result).toEqual({
      ok: true,
      value: {
        id: 'f-1',
        editUrl: 'https://docs.google.com/forms/d/f-1/edit',
        responderUrl: 'https://docs.google.com/forms/d/e/1FAIp-f-1/viewform',
      },
    });
    expect(api.calls[0]).toEqual({
      path: '/v1/forms',
      body: { info: { title: 'Fractions quiz', documentTitle: 'Fractions quiz' } },
    });
    expect(api.calls[1]).toEqual({
      path: '/v1/forms/f-1:batchUpdate',
      body: {
        requests: [
          {
            updateSettings: {
              settings: { quizSettings: { isQuiz: true } },
              updateMask: 'quizSettings.isQuiz',
            },
          },
          {
            updateFormInfo: { info: { description: 'Show your work.' }, updateMask: 'description' },
          },
          {
            createItem: {
              item: {
                title: '1/2 + 1/4?',
                description: 'Simplify.',
                questionItem: {
                  question: {
                    required: true,
                    grading: { pointValue: 5, correctAnswers: { answers: [{ value: '3/4' }] } },
                    choiceQuestion: {
                      type: 'RADIO',
                      options: [{ value: '3/4' }, { value: '2/6' }],
                    },
                  },
                },
              },
              location: { index: 0 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Half of 8',
                questionItem: {
                  question: {
                    required: true,
                    grading: { pointValue: 2, correctAnswers: { answers: [{ value: '4' }] } },
                    textQuestion: { paragraph: false },
                  },
                },
              },
              location: { index: 1 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Explain',
                questionItem: { question: { required: true, textQuestion: { paragraph: true } } },
              },
              location: { index: 2 },
            },
          },
          {
            createItem: {
              item: {
                title: 'Match',
                questionGroupItem: {
                  questions: [
                    { required: true, rowQuestion: { title: '1/2' } },
                    { required: true, rowQuestion: { title: '1/4' } },
                  ],
                  grid: {
                    columns: { type: 'RADIO', options: [{ value: 'half' }, { value: 'quarter' }] },
                  },
                },
              },
              location: { index: 3 },
            },
          },
        ],
      },
    });
  });

  it('asks the teacher to reconnect when Google refuses the Forms scope', async () => {
    const api = formsApi('t', 403);
    expect(await new GoogleFormsApi(api.fetchFn).createQuiz('t', quiz)).toEqual({
      ok: false,
      error: { code: 'insufficient_scope' },
    });
  });

  it('reports a server error or an unreachable Google as unavailable', async () => {
    expect(await new GoogleFormsApi(formsApi('t', 503).fetchFn).createQuiz('t', quiz)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
    const offline = () => Promise.reject(new Error('offline'));
    expect(await new GoogleFormsApi(offline).createQuiz('t', quiz)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});

describe('GoogleClassroom with a Drive file', () => {
  it('gives each student their own copy, or lets everyone view the same file', async () => {
    const api = classroomApi(fixture.accessToken);
    for (const shareMode of ['copy', 'view'] as const) {
      await new GoogleClassroom(api.fetchFn).createCoursework(fixture.accessToken, 'c-1', {
        title: 'Test',
        description: '',
        material: { kind: 'driveFile', driveFileId: 'drive-1', shareMode },
        dueDate: null,
      });
    }
    expect(api.posted.map((p) => (p as { materials: unknown }).materials)).toEqual([
      [{ driveFile: { driveFile: { id: 'drive-1' }, shareMode: 'STUDENT_COPY' } }],
      [{ driveFile: { driveFile: { id: 'drive-1' }, shareMode: 'VIEW' } }],
    ]);
  });
});

/** Google Drive's multipart upload, answering like the recorded real responses. */
function driveApi(accessToken: string, status = 200) {
  const uploads: { url: string; contentType: string | null; body: string }[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${accessToken}`) {
      return Response.json({ error: { code: 401 } }, { status: 401 });
    }
    if (status !== 200) return Response.json({ error: {} }, { status });
    uploads.push({
      url,
      contentType: headers.get('content-type'),
      body: await new Response(init?.body).text(),
    });
    return Response.json({ id: 'drive-file-1', name: 'test.pdf', mimeType: 'application/pdf' });
  };
  return { fetchFn, uploads };
}

googleDriveContract(
  'GoogleDriveApi',
  (token) => new GoogleDriveApi(driveApi(token).fetchFn),
  'ya29.recorded',
);
googleDriveContract('LocalDrive', () => new LocalDrive(), localClassroomFixture.accessToken);

describe('GoogleDriveApi', () => {
  const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x41, 0x42]);

  it('uploads the Word document as it is, without converting it', async () => {
    const api = driveApi('t');
    expect(
      await new GoogleDriveApi(api.fetchFn).uploadWordDocument('t', {
        name: 'Unit 3.docx',
        bytes: docx,
      }),
    ).toEqual({
      ok: true,
      value: { id: 'drive-file-1', url: 'https://drive.google.com/file/d/drive-file-1/view' },
    });
    const [upload] = api.uploads;
    expect(upload?.url).toBe(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    );
    expect(upload?.contentType).toMatch(/^multipart\/related; boundary=/);
    expect(upload?.body).toContain(
      '{"name":"Unit 3.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}',
    );
    expect(upload?.body).toContain(
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(upload?.body).toContain('PK');
  });

  it('reports a server error or an unreachable Google as unavailable', async () => {
    const file = { name: 'a.docx', bytes: docx };
    expect(
      await new GoogleDriveApi(driveApi('t', 503).fetchFn).uploadWordDocument('t', file),
    ).toEqual({ ok: false, error: { code: 'unavailable' } });
    const offline = () => Promise.reject(new Error('offline'));
    expect(await new GoogleDriveApi(offline).uploadWordDocument('t', file)).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});
